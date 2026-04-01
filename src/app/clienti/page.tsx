"use client";

import { FormEvent, Fragment, useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
};

type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";

type Subscription = {
  id: string;
  customerId: string;
  quantity: number;
  plan: {
    name: string;
  };
  status: SubscriptionStatus;
  nextBillingDate: string;
  notes: string | null;
};

function isPlaceholderEmail(email: string | null) {
  return !!email && email.endsWith("@placeholder.local");
}

export default function ClientiPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  async function fetchCustomersAndSubscriptions() {
    setLoading(true);
    setError(null);

    try {
      const [customersResponse, subscriptionsResponse] = await Promise.all([
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/subscriptions", { cache: "no-store" }),
      ]);

      if (!customersResponse.ok || !subscriptionsResponse.ok) {
        throw new Error();
      }

      const customersPayload = (await customersResponse.json()) as Customer[];
      const subscriptionsPayload = (await subscriptionsResponse.json()) as Subscription[];
      setCustomers(customersPayload);
      setSubscriptions(subscriptionsPayload);
    } catch {
      setError("Impossibile caricare clienti e abbonamenti");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchCustomersAndSubscriptions();
  }, []);

  async function onCreateCustomer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore inserimento cliente");
      return;
    }

    setCreateForm({ name: "", email: "", phone: "" });
    setShowCreateSection(false);
    setNotice("Cliente inserito con successo");
    await fetchCustomersAndSubscriptions();
  }

  function onStartEdit(customer: Customer) {
    setEditingId(customer.id);
    setEditForm({
      name: customer.name,
      email: customer.email && !isPlaceholderEmail(customer.email) ? customer.email : "",
      phone: customer.phone || "",
    });
    setError(null);
    setNotice(null);
  }

  function onCancelEdit() {
    setEditingId(null);
    setEditForm({ name: "", email: "", phone: "" });
  }

  async function onSaveEdit(customerId: string) {
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore modifica cliente");
      return;
    }

    onCancelEdit();
    setNotice("Cliente aggiornato");
    await fetchCustomersAndSubscriptions();
  }

  async function onDeleteCustomer(customerId: string) {
    const confirmed = window.confirm("Confermi la cancellazione del cliente?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    const response = await fetch(`/api/customers/${customerId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore cancellazione cliente");
      return;
    }

    setNotice("Cliente cancellato");
    if (editingId === customerId) {
      onCancelEdit();
    }
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null);
    }
    await fetchCustomersAndSubscriptions();
  }

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Clienti</h1>
            <p className="text-sm text-zinc-600">Gestione anagrafica clienti</p>
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
            Inserisci nuovo cliente
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
            <form onSubmit={(event) => void onCreateCustomer(event)} className="grid gap-3 md:grid-cols-2">
              <h2 className="col-span-full text-lg font-semibold">Nuovo Cliente</h2>
              <Input
                label="Nome"
                value={createForm.name}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, name: value }))}
                required
              />
              <Input
                label="Email"
                type="email"
                value={createForm.email}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, email: value }))}
              />
              <Input
                label="Telefono"
                value={createForm.phone}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))}
              />
              <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Salva cliente
              </button>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-sky-50 px-4 py-3 text-sky-800">
            <h2 className="text-lg font-semibold">Lista Clienti</h2>
          </div>

          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2">Nome</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Telefono</th>
                  <th className="px-4 py-2">Abbonamenti attivi</th>
                  <th className="px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const customerSubscriptions = subscriptions.filter(
                    (subscription) => subscription.customerId === customer.id,
                  );
                  const activeSubscriptions = customerSubscriptions.filter(
                    (subscription) => subscription.status === "ACTIVE",
                  );
                  const isExpanded = expandedCustomerId === customer.id;

                  return (
                    <Fragment key={customer.id}>
                      <tr className="border-t border-zinc-200 align-top">
                        <td className="px-4 py-2">
                          {editingId === customer.id ? (
                            <input
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1"
                              value={editForm.name}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                          ) : (
                            customer.name
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editingId === customer.id ? (
                            <input
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1"
                              type="email"
                              value={editForm.email}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, email: event.target.value }))
                              }
                            />
                          ) : (
                            customer.email && !isPlaceholderEmail(customer.email)
                              ? customer.email
                              : "-"
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editingId === customer.id ? (
                            <input
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1"
                              value={editForm.phone}
                              onChange={(event) =>
                                setEditForm((prev) => ({ ...prev, phone: event.target.value }))
                              }
                            />
                          ) : (
                            customer.phone || "-"
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50"
                            onClick={() =>
                              setExpandedCustomerId((prev) =>
                                prev === customer.id ? null : customer.id,
                              )
                            }
                          >
                            {activeSubscriptions.length} {isExpanded ? "▲" : "▼"}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            {editingId === customer.id ? (
                              <>
                                <button
                                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                                  type="button"
                                  onClick={() => void onSaveEdit(customer.id)}
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
                                onClick={() => onStartEdit(customer)}
                              >
                                Modifica
                              </button>
                            )}
                            <button
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-red-700"
                              type="button"
                              onClick={() => void onDeleteCustomer(customer.id)}
                            >
                              Cancella
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-zinc-100 bg-zinc-50">
                          <td className="px-4 py-3 text-sm text-zinc-700" colSpan={5}>
                            {customerSubscriptions.length === 0 ? (
                              <p>Nessun abbonamento associato.</p>
                            ) : (
                              <ul className="space-y-1">
                                {customerSubscriptions.map((subscription) => (
                                  <li key={subscription.id} className="rounded-md border border-zinc-200 bg-white px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="font-medium text-zinc-900">{subscription.plan.name}</span>
                                      <span className="text-zinc-400">•</span>
                                      <span>Quantità: {subscription.quantity}</span>
                                      <span className="text-zinc-400">•</span>
                                      <span
                                        className={`inline-block h-2.5 w-2.5 self-center rounded-full ${
                                          subscription.status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500"
                                        }`}
                                        title={subscription.status === "ACTIVE" ? "Attivo" : "Non attivo"}
                                        aria-label={subscription.status === "ACTIVE" ? "Attivo" : "Non attivo"}
                                      />
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-700">
                                      <span>
                                        Prossimo rinnovo: {new Date(subscription.nextBillingDate).toLocaleDateString("it-IT")}
                                      </span>
                                      <span className="text-zinc-400">•</span>
                                      <span>Note: {subscription.notes || "-"}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
