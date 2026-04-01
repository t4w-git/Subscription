"use client";

import { FormEvent, useEffect, useState } from "react";

type Supplier = {
  id: string;
  name: string;
};

export default function FornitoriPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
  });

  async function fetchSuppliers() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/suppliers", { cache: "no-store" });
      if (!response.ok) {
        throw new Error();
      }

      const payload = (await response.json()) as Supplier[];
      setSuppliers(payload);
    } catch {
      setError("Impossibile caricare i fornitori");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSuppliers();
  }, []);

  async function onCreateSupplier(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore inserimento fornitore");
      return;
    }

    setCreateForm({ name: "" });
    setShowCreateSection(false);
    setNotice("Fornitore inserito con successo");
    await fetchSuppliers();
  }

  function onStartEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setEditForm({
      name: supplier.name,
    });
    setError(null);
    setNotice(null);
  }

  function onCancelEdit() {
    setEditingId(null);
    setEditForm({ name: "" });
  }

  async function onSaveEdit(supplierId: string) {
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore modifica fornitore");
      return;
    }

    onCancelEdit();
    setNotice("Fornitore aggiornato");
    await fetchSuppliers();
  }

  async function onDeleteSupplier(supplierId: string) {
    const confirmed = window.confirm("Confermi la cancellazione del fornitore?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    const response = await fetch(`/api/suppliers/${supplierId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore cancellazione fornitore");
      return;
    }

    setNotice("Fornitore cancellato");
    if (editingId === supplierId) {
      onCancelEdit();
    }
    await fetchSuppliers();
  }

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Fornitori</h1>
            <p className="text-sm text-zinc-600">Gestione anagrafica fornitori</p>
          </div>
          <button
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
            type="button"
            onClick={() => {
              setShowCreateSection((prev) => !prev);
              setError(null);
              setNotice(null);
            }}
          >
            Inserisci nuovo fornitore
          </button>
        </header>

        {error && (
          <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">
            {notice}
          </p>
        )}

        {showCreateSection && (
          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <form onSubmit={(event) => void onCreateSupplier(event)} className="grid gap-3 md:grid-cols-2">
              <h2 className="col-span-full text-lg font-semibold">Nuovo Fornitore</h2>
              <Input
                label="Nome"
                value={createForm.name}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, name: value }))}
                required
              />
              <div />
              <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Salva fornitore
              </button>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-sky-50 px-4 py-3 text-sky-800">
            <h2 className="text-lg font-semibold">Lista Fornitori</h2>
          </div>

          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-t border-zinc-200 align-top">
                    <td className="px-4 py-2">
                      {editingId === supplier.id ? (
                        <input
                          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1"
                          value={editForm.name}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                      ) : (
                        supplier.name
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {editingId === supplier.id ? (
                          <>
                            <button
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              type="button"
                              onClick={() => void onSaveEdit(supplier.id)}
                            >
                              Salva
                            </button>
                            <button
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              type="button"
                              onClick={onCancelEdit}
                            >
                              Annulla
                            </button>
                          </>
                        ) : (
                          <button
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                            type="button"
                            onClick={() => onStartEdit(supplier)}
                          >
                            Modifica
                          </button>
                        )}
                        <button
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-red-700"
                          type="button"
                          onClick={() => void onDeleteSupplier(supplier.id)}
                        >
                          Cancella
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-600">{label}</span>
      <input
        className="rounded-md border border-zinc-300 bg-white px-3 py-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        required={required}
      />
    </label>
  );
}
