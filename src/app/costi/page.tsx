"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type ExpenseFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL";

type Supplier = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  supplierId: string | null;
  supplier: Supplier | null;
  serviceName: string;
  amount: number;
  frequency: ExpenseFrequency;
  expenseDate: string;
  notes: string | null;
};

export default function CostiPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreateSection, setShowCreateSection] = useState(false);

  const [createForm, setCreateForm] = useState({
    supplierId: "",
    serviceName: "",
    amount: "",
    frequency: "MONTHLY" as ExpenseFrequency,
    expenseDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  function formatApiError(message: { error?: string; detail?: string } | null, fallback: string) {
    if (!message) {
      return fallback;
    }

    if (message.error && message.detail) {
      return `${message.error} (${message.detail})`;
    }

    return message.error || fallback;
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [suppliersRes, expensesRes] = await Promise.all([
        fetch("/api/suppliers", { cache: "no-store" }),
        fetch("/api/expenses", { cache: "no-store" }),
      ]);

      if (!suppliersRes.ok || !expensesRes.ok) {
        const expensesMessage = expensesRes.ok
          ? null
          : ((await expensesRes.json().catch(() => null)) as { error?: string; detail?: string } | null);
        throw new Error(formatApiError(expensesMessage, "Impossibile caricare i costi"));
      }

      setSuppliers((await suppliersRes.json()) as Supplier[]);
      setExpenses((await expensesRes.json()) as Expense[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossibile caricare i costi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function onCreateExpense(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: createForm.supplierId || undefined,
        serviceName: createForm.serviceName,
        amount: createForm.amount,
        frequency: createForm.frequency,
        expenseDate: createForm.expenseDate || undefined,
        notes: createForm.notes,
      }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setError(formatApiError(message, "Errore inserimento costo"));
      return;
    }

    setCreateForm({
      supplierId: "",
      serviceName: "",
      amount: "",
      frequency: "MONTHLY",
      expenseDate: new Date().toISOString().slice(0, 10),
      notes: "",
    });
    setShowCreateSection(false);
    setNotice("Costo inserito con successo");
    await fetchData();
  }

  async function onDeleteExpense(expenseId: string) {
    const confirmed = window.confirm("Confermi la cancellazione del costo?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    const response = await fetch(`/api/expenses/${expenseId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setError(formatApiError(message, "Errore cancellazione costo"));
      return;
    }

    setNotice("Costo cancellato");
    await fetchData();
  }

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Costi - Gestione</h1>
            <p className="text-sm text-zinc-600">Costi generici non legati al singolo servizio (es. pacchetti hosting)</p>
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
            Inserisci nuovo costo
          </button>
        </header>

        {error && <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">{error}</p>}
        {notice && <p className="rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">{notice}</p>}

        {showCreateSection && (
          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <form onSubmit={(event) => void onCreateExpense(event)} className="grid gap-3 md:grid-cols-2">
              <h2 className="col-span-full text-lg font-semibold">Nuovo costo</h2>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Descrizione costo</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.serviceName}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, serviceName: event.target.value }))}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Importo</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="number"
                  step="0.01"
                  value={createForm.amount}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, amount: event.target.value }))}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Frequenza</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.frequency}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, frequency: event.target.value as ExpenseFrequency }))
                  }
                >
                  <option value="MONTHLY">Mensile</option>
                  <option value="QUARTERLY">Trimestrale</option>
                  <option value="ANNUAL">Annuale</option>
                  <option value="ONE_TIME">Una tantum</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Data costo</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="date"
                  value={createForm.expenseDate}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, expenseDate: event.target.value }))}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Fornitore (opzionale)</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.supplierId}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, supplierId: event.target.value }))}
                >
                  <option value="">Generico</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Note</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.notes}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </label>

              <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Salva costo
              </button>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-rose-50 px-4 py-3 text-rose-800">
            <h2 className="text-lg font-semibold">Lista costi</h2>
          </div>

          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2">Descrizione</th>
                  <th className="px-4 py-2">Fornitore</th>
                  <th className="px-4 py-2">Frequenza</th>
                  <th className="px-4 py-2">Importo</th>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-zinc-200 align-top">
                    <td className="px-4 py-2">{expense.serviceName}</td>
                    <td className="px-4 py-2">{expense.supplier?.name || "Generico"}</td>
                    <td className="px-4 py-2">
                      {expense.frequency === "MONTHLY"
                        ? "Mensile"
                        : expense.frequency === "QUARTERLY"
                          ? "Trimestrale"
                        : expense.frequency === "ANNUAL"
                          ? "Annuale"
                          : "Una tantum"}
                    </td>
                    <td className="px-4 py-2">
                      {new Intl.NumberFormat("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      }).format(expense.amount)}
                    </td>
                    <td className="px-4 py-2">{new Date(expense.expenseDate).toLocaleDateString("it-IT")}</td>
                    <td className="px-4 py-2">
                      <button
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-red-700"
                        type="button"
                        onClick={() => void onDeleteExpense(expense.id)}
                      >
                        Cancella
                      </button>
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
