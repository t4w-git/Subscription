"use client";

import { FormEvent, useEffect, useState } from "react";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";

type Supplier = {
  id: string;
  name: string;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  supplierId: string | null;
  providerCost: number | null;
  promotionDiscountPercent: number | null;
  promotionDurationMonths: number | null;
  supplier?: Supplier | null;
};

const billingCycleLabels: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMIANNUAL: "Semiannual",
  ANNUAL: "Annual",
};

export default function ServiziModificaPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    name: "",
    price: "",
    currency: "EUR",
    billingCycle: "MONTHLY" as BillingCycle,
    supplierId: "",
    providerCost: "",
    promotionDiscountPercent: "",
    promotionDurationMonths: "12",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    price: "",
    currency: "EUR",
    billingCycle: "MONTHLY" as BillingCycle,
    supplierId: "",
    providerCost: "",
    promotionDiscountPercent: "",
    promotionDurationMonths: "",
  });

  async function fetchData() {
    setLoading(true);
    setError(null);

    try {
      const [plansRes, suppliersRes] = await Promise.all([
        fetch("/api/plans", { cache: "no-store" }),
        fetch("/api/suppliers", { cache: "no-store" }),
      ]);

      if (!plansRes.ok || !suppliersRes.ok) {
        throw new Error();
      }

      const plansData = (await plansRes.json()) as Plan[];
      const suppliersData = (await suppliersRes.json()) as Supplier[];

      setPlans(plansData);
      setSuppliers(suppliersData);
    } catch {
      setError("Impossibile caricare i servizi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  function onStartEdit(plan: Plan) {
    setEditingId(plan.id);
    setEditForm({
      name: plan.name,
      price: String(plan.price),
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      supplierId: plan.supplierId || "",
      providerCost: plan.providerCost !== null ? String(plan.providerCost) : "",
      promotionDiscountPercent:
        plan.promotionDiscountPercent !== null ? String(plan.promotionDiscountPercent) : "",
      promotionDurationMonths:
        plan.promotionDurationMonths !== null ? String(plan.promotionDurationMonths) : "",
    });
    setError(null);
    setNotice(null);
  }

  function onCancelEdit() {
    setEditingId(null);
    setEditForm({
      name: "",
      price: "",
      currency: "EUR",
      billingCycle: "MONTHLY",
      supplierId: "",
      providerCost: "",
      promotionDiscountPercent: "",
      promotionDurationMonths: "",
    });
  }

  async function onSaveEdit(planId: string) {
    setError(null);
    setNotice(null);

    const response = await fetch(`/api/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        price: Number(editForm.price),
        currency: editForm.currency,
        billingCycle: editForm.billingCycle,
        supplierId: editForm.supplierId || null,
        providerCost: editForm.providerCost ? Number(editForm.providerCost) : null,
        promotionDiscountPercent: editForm.promotionDiscountPercent
          ? Number(editForm.promotionDiscountPercent)
          : null,
        promotionDurationMonths: editForm.promotionDurationMonths
          ? Number(editForm.promotionDurationMonths)
          : null,
      }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore modifica servizio");
      return;
    }

    onCancelEdit();
    setNotice("Servizio aggiornato");
    await fetchData();
  }

  async function onDeletePlan(planId: string) {
    const confirmed = window.confirm("Confermi la cancellazione del servizio?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    const response = await fetch(`/api/plans/${planId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore cancellazione servizio");
      return;
    }

    setNotice("Servizio cancellato");
    if (editingId === planId) {
      onCancelEdit();
    }
    await fetchData();
  }

  async function onCreateService(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createForm,
        price: Number(createForm.price),
        supplierId: createForm.supplierId || undefined,
        providerCost: createForm.providerCost ? Number(createForm.providerCost) : undefined,
        promotionDiscountPercent: createForm.promotionDiscountPercent
          ? Number(createForm.promotionDiscountPercent)
          : undefined,
        promotionDurationMonths: createForm.promotionDiscountPercent
          ? Number(createForm.promotionDurationMonths)
          : undefined,
      }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore creazione servizio");
      return;
    }

    setCreateForm({
      name: "",
      price: "",
      currency: "EUR",
      billingCycle: "MONTHLY",
      supplierId: "",
      providerCost: "",
      promotionDiscountPercent: "",
      promotionDurationMonths: "12",
    });
    setShowCreateSection(false);
    setNotice("Servizio creato con successo");
    await fetchData();
  }

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Servizi - Gestione</h1>
            <p className="text-sm text-zinc-600">Inserimento, modifica e cancellazione servizi</p>
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
            Inserisci nuovo servizio
          </button>
        </header>

        {error && (
          <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">{error}</p>
        )}

        {notice && (
          <p className="rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">{notice}</p>
        )}

        {showCreateSection && (
          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <form onSubmit={(event) => void onCreateService(event)} className="grid gap-3 md:grid-cols-2">
              <h2 className="col-span-full text-lg font-semibold">Nuovo Servizio</h2>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Nome servizio</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Prezzo cliente</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="number"
                  step="0.01"
                  value={createForm.price}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, price: event.target.value }))}
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Valuta</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.currency}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                  }
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Billing cycle</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.billingCycle}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, billingCycle: event.target.value as BillingCycle }))
                  }
                  required
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="SEMIANNUAL">Semiannual</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Fornitore (opzionale)</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.supplierId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, supplierId: event.target.value }))
                  }
                >
                  <option value="">Seleziona...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Costo interno</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="number"
                  step="0.01"
                  value={createForm.providerCost}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, providerCost: event.target.value }))
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Promozione sconto %</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="number"
                  step="1"
                  value={createForm.promotionDiscountPercent}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, promotionDiscountPercent: event.target.value }))
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Durata promo mesi</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="number"
                  step="1"
                  value={createForm.promotionDurationMonths}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, promotionDurationMonths: event.target.value }))
                  }
                />
              </label>

              <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Salva servizio
              </button>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-amber-50 px-4 py-3 text-amber-800">
            <h2 className="text-lg font-semibold">Lista Servizi</h2>
          </div>

          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-2">Servizio</th>
                  <th className="px-4 py-2">Prezzo cliente</th>
                  <th className="px-4 py-2">Billing cycle</th>
                  <th className="px-4 py-2">Fornitore</th>
                  <th className="px-4 py-2">Costo interno</th>
                  <th className="px-4 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-t border-zinc-200 align-top">
                    <td className="px-4 py-2">
                      {editingId === plan.id ? (
                        <input
                          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1"
                          value={editForm.name}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      ) : (
                        plan.name
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === plan.id ? (
                        <input
                          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1"
                          type="number"
                          step="0.01"
                          value={editForm.price}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                        />
                      ) : (
                        new Intl.NumberFormat("it-IT", {
                          style: "currency",
                          currency: plan.currency,
                        }).format(plan.price)
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === plan.id ? (
                        <select
                          className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                          value={editForm.billingCycle}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, billingCycle: event.target.value as BillingCycle }))
                          }
                        >
                          <option value="MONTHLY">Monthly</option>
                          <option value="QUARTERLY">Quarterly</option>
                          <option value="SEMIANNUAL">Semiannual</option>
                          <option value="ANNUAL">Annual</option>
                        </select>
                      ) : (
                        billingCycleLabels[plan.billingCycle]
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === plan.id ? (
                        <select
                          className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                          value={editForm.supplierId}
                          onChange={(event) => setEditForm((prev) => ({ ...prev, supplierId: event.target.value }))}
                        >
                          <option value="">Seleziona...</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        plan.supplier?.name || "-"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === plan.id ? (
                        <input
                          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1"
                          type="number"
                          step="0.01"
                          value={editForm.providerCost}
                          onChange={(event) =>
                            setEditForm((prev) => ({ ...prev, providerCost: event.target.value }))
                          }
                        />
                      ) : plan.providerCost !== null ? (
                        new Intl.NumberFormat("it-IT", {
                          style: "currency",
                          currency: plan.currency,
                        }).format(plan.providerCost)
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {editingId === plan.id ? (
                          <>
                            <button
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                              type="button"
                              onClick={() => void onSaveEdit(plan.id)}
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
                            onClick={() => onStartEdit(plan)}
                          >
                            Modifica
                          </button>
                        )}
                        <button
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-red-700"
                          type="button"
                          onClick={() => void onDeletePlan(plan.id)}
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
