"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type DurationUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";

type Customer = {
  id: string;
  name: string;
  email: string | null;
};

function isPlaceholderEmail(email: string | null) {
  return !!email && email.endsWith("@placeholder.local");
}

type Plan = {
  id: string;
  name: string;
  billingCycle: BillingCycle;
  price: number;
  currency: string;
  promotionDiscountPercent: number | null;
  promotionDurationMonths: number | null;
};

type Subscription = {
  id: string;
  customer: Customer;
  plan: Plan;
  startDate: string;
  billingCycle: BillingCycle | null;
  quantity: number;
  nextBillingDate: string;
  status: SubscriptionStatus;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  notes: string | null;
};

const cycleMonths: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

const billingCycleLabels: Record<BillingCycle, string> = {
  MONTHLY: "Mensile",
  QUARTERLY: "Trimestrale",
  SEMIANNUAL: "Semestrale",
  ANNUAL: "Annuale",
};

const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Attivo",
  PAUSED: "In pausa",
  CANCELED: "Cancellato",
};

export default function AbbonamentiModificaPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sendingCountForId, setSendingCountForId] = useState<string | null>(null);
  const [sendingRetroForId, setSendingRetroForId] = useState<string | null>(null);
  const [retroYearById, setRetroYearById] = useState<Record<string, string>>({});
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    customerId: "",
    planId: "",
    billingCycle: "MONTHLY" as BillingCycle,
    quantity: "1",
    startDate: new Date().toISOString().slice(0, 10),
    durationValue: "",
    durationUnit: "MONTHS" as DurationUnit,
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    status: "ACTIVE" as SubscriptionStatus,
    billingCycle: "MONTHLY" as BillingCycle,
    quantity: "1",
    startDate: "",
    durationValue: "",
    durationUnit: "MONTHS" as DurationUnit,
    notes: "",
  });

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }),
    [],
  );

  const getEffectiveCycle = (subscription: Subscription) =>
    subscription.billingCycle || subscription.plan.billingCycle;

  const getCustomerUnitPrice = (subscription: Subscription) => {
    const planMonths = cycleMonths[subscription.plan.billingCycle];
    const effectiveCycle = getEffectiveCycle(subscription);
    const effectiveMonths = cycleMonths[effectiveCycle];
    return (subscription.plan.price / planMonths) * effectiveMonths;
  };

  const getCustomerTotalPrice = (subscription: Subscription, quantity: number) =>
    getCustomerUnitPrice(subscription) * quantity;

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === createForm.planId) || null,
    [plans, createForm.planId],
  );

  const billingPreview = useMemo(() => {
    if (!selectedPlan || !createForm.startDate) {
      return null;
    }

    const fromMonths = cycleMonths[selectedPlan.billingCycle];
    const toMonths = cycleMonths[createForm.billingCycle];
    const monthlyPrice = selectedPlan.price / fromMonths;
    const quantity = Number(createForm.quantity) > 0 ? Number(createForm.quantity) : 1;
    const baseAmount = Math.round(monthlyPrice * toMonths * quantity * 100) / 100;

    const discountedAmount = selectedPlan.promotionDiscountPercent
      ? Math.round(baseAmount * (1 - selectedPlan.promotionDiscountPercent / 100) * 100) / 100
      : baseAmount;

    const start = new Date(createForm.startDate);
    const next = new Date(createForm.startDate);
    next.setMonth(next.getMonth() + toMonths);

    return {
      amount: discountedAmount,
      todayInvoiceDate: start,
      nextInvoiceDate: next,
      currency: selectedPlan.currency,
    };
  }, [selectedPlan, createForm.billingCycle, createForm.startDate, createForm.quantity]);

  const subscriptionsByCustomer = useMemo(() => {
    const grouped = new Map<string, { customerId: string; customerName: string; items: Subscription[] }>();

    for (const subscription of subscriptions) {
      const existing = grouped.get(subscription.customer.id);

      if (existing) {
        existing.items.push(subscription);
      } else {
        grouped.set(subscription.customer.id, {
          customerId: subscription.customer.id,
          customerName: subscription.customer.name,
          items: [subscription],
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.customerName.localeCompare(b.customerName, "it-IT"),
    );
  }, [subscriptions]);

  async function fetchInitialData() {
    setLoading(true);
    setError(null);

    try {
      const [subscriptionsRes, customersRes, plansRes] = await Promise.all([
        fetch("/api/subscriptions", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/plans", { cache: "no-store" }),
      ]);

      if (!subscriptionsRes.ok) {
        const message = (await subscriptionsRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(message?.error || "Impossibile caricare gli abbonamenti");
      }

      if (!customersRes.ok || !plansRes.ok) {
        throw new Error("Impossibile caricare dati abbonamenti");
      }

      const subscriptionsPayload = (await subscriptionsRes.json()) as Subscription[];
      const customersPayload = (await customersRes.json()) as Customer[];
      const plansPayload = (await plansRes.json()) as Plan[];

      setSubscriptions(subscriptionsPayload);
      setCustomers(customersPayload);
      setPlans(plansPayload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Impossibile caricare gli abbonamenti";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSubscriptions() {
    setError(null);

    try {
      const response = await fetch("/api/subscriptions", { cache: "no-store" });
      if (!response.ok) {
        const message = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(message?.error || "Impossibile caricare gli abbonamenti");
      }

      const payload = (await response.json()) as Subscription[];
      setSubscriptions(payload);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Impossibile caricare gli abbonamenti";
      setError(message);
    }
  }

  useEffect(() => {
    void fetchInitialData();
  }, []);

  async function onCreateSubscription(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const response = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...createForm,
        quantity: Number(createForm.quantity) > 0 ? Number(createForm.quantity) : 1,
        durationValue: createForm.durationValue ? Number(createForm.durationValue) : undefined,
        durationUnit: createForm.durationValue ? createForm.durationUnit : undefined,
      }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore creazione abbonamento");
      return;
    }

    setCreateForm({
      customerId: "",
      planId: "",
      billingCycle: "MONTHLY",
      quantity: "1",
      startDate: new Date().toISOString().slice(0, 10),
      durationValue: "",
      durationUnit: "MONTHS",
      notes: "",
    });
    setShowCreateSection(false);
    setNotice("Abbonamento creato: la data di partenza corrisponde alla data della prima fattura");
    await fetchSubscriptions();
  }

  function onStartEdit(subscription: Subscription) {
    setEditingId(subscription.id);
    setEditForm({
      status: subscription.status,
      billingCycle: subscription.billingCycle || subscription.plan.billingCycle,
      quantity: String(subscription.quantity || 1),
      startDate: subscription.startDate.slice(0, 10),
      durationValue: subscription.durationValue ? String(subscription.durationValue) : "",
      durationUnit: subscription.durationUnit || "MONTHS",
      notes: subscription.notes || "",
    });
    setError(null);
    setNotice(null);
  }

  function onCancelEdit() {
    setEditingId(null);
    setEditForm({
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      quantity: "1",
      startDate: "",
      durationValue: "",
      durationUnit: "MONTHS",
      notes: "",
    });
  }

  async function onSaveEdit(subscription: Subscription) {
    setError(null);
    setNotice(null);

    const isActivatingNow = subscription.status !== "ACTIVE" && editForm.status === "ACTIVE";
    if (isActivatingNow && !editForm.startDate) {
      setError("Per attivare l'abbonamento indica la data della prima fattura");
      return;
    }

    const response = await fetch(`/api/subscriptions/${subscription.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: editForm.status,
        billingCycle: editForm.billingCycle,
        quantity: Number(editForm.quantity) > 0 ? Number(editForm.quantity) : 1,
        startDate: editForm.startDate || undefined,
        activationStartDate: isActivatingNow ? editForm.startDate : undefined,
        durationValue: editForm.durationValue ? Number(editForm.durationValue) : null,
        durationUnit: editForm.durationValue ? editForm.durationUnit : null,
        notes: editForm.notes,
      }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore modifica abbonamento");
      return;
    }

    onCancelEdit();
    setNotice("Abbonamento aggiornato");
    await fetchSubscriptions();
  }

  async function onDeleteSubscription(subscriptionId: string) {
    const confirmed = window.confirm("Confermi la cancellazione dell'abbonamento?");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);

    const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(message?.error || "Errore cancellazione abbonamento");
      return;
    }

    setNotice("Abbonamento cancellato");
    if (editingId === subscriptionId) {
      onCancelEdit();
    }
    await fetchSubscriptions();
  }

  async function onCreateAndSendCount(subscriptionId: string) {
    setError(null);
    setNotice(null);
    setSendingCountForId(subscriptionId);

    const response = await fetch(`/api/subscriptions/${subscriptionId}/conteggio`, {
      method: "POST",
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setError(message?.detail ? `${message.error} (${message.detail})` : message?.error || "Invio conteggio fallito");
      setSendingCountForId(null);
      return;
    }

    const payload = (await response.json()) as { message?: string; to?: string };
    setNotice(payload.to ? `${payload.message || "Conteggio inviato"}: ${payload.to}` : payload.message || "Conteggio inviato");
    setSendingCountForId(null);
  }

  async function onSendRetroactive(subscriptionId: string) {
    setError(null);
    setNotice(null);

    const year = Number(retroYearById[subscriptionId] || "");
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      setError("Inserisci un anno di riferimento valido (1900-2100)");
      return;
    }

    setSendingRetroForId(subscriptionId);

    const response = await fetch(`/api/subscriptions/${subscriptionId}/retroattivo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceYear: year }),
    });

    if (!response.ok) {
      const message = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setError(
        message?.detail
          ? `${message.error} (${message.detail})`
          : message?.error || "Invio abbonamento retroattivo fallito",
      );
      setSendingRetroForId(null);
      return;
    }

    const payload = (await response.json()) as { message?: string; to?: string };
    setNotice(
      payload.to
        ? `${payload.message || "Invio abbonamento retroattivo inviato"}: ${payload.to}`
        : payload.message || "Invio abbonamento retroattivo inviato",
    );
    setSendingRetroForId(null);
  }

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Abbonamenti</h1>
            <p className="text-sm text-zinc-600">Gestione abbonamenti</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
              href="/api/subscriptions/export"
            >
              Esporta abbonamenti/clienti
            </Link>
            <Link
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
              href="/abbonamenti/export-pdf"
              target="_blank"
              rel="noreferrer"
            >
              Esporta PDF
            </Link>
            <button
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
              type="button"
              onClick={() => {
                setShowCreateSection((prev) => !prev);
                setError(null);
                setNotice(null);
              }}
            >
              Inserisci nuovo abbonamento
            </button>
          </div>
        </header>

        {error && <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">{error}</p>}
        {notice && <p className="rounded-md border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">{notice}</p>}

        {showCreateSection && (
          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <form onSubmit={(event) => void onCreateSubscription(event)} className="grid gap-3 md:grid-cols-2">
              <h2 className="col-span-full text-lg font-semibold">Nuovo Abbonamento</h2>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Cliente</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.customerId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, customerId: event.target.value }))
                  }
                  required
                >
                  <option value="">Seleziona...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.email && !isPlaceholderEmail(customer.email)
                        ? `${customer.name} (${customer.email})`
                        : customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Servizio</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.planId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, planId: event.target.value }))
                  }
                  required
                >
                  <option value="">Seleziona...</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Ciclicità</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.billingCycle}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, billingCycle: event.target.value as BillingCycle }))
                  }
                  required
                >
                  <option value="MONTHLY">Mensile</option>
                  <option value="QUARTERLY">Trimestrale</option>
                  <option value="SEMIANNUAL">Semestrale</option>
                  <option value="ANNUAL">Annuale</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Quantità</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="number"
                  min={1}
                  value={createForm.quantity}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Data partenza abbonamento (prima fattura)</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="date"
                  value={createForm.startDate}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, startDate: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Durata (opzionale)</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  type="number"
                  min={1}
                  value={createForm.durationValue}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, durationValue: event.target.value }))
                  }
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Unità durata</span>
                <select
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.durationUnit}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, durationUnit: event.target.value as DurationUnit }))
                  }
                >
                  <option value="DAYS">Giorni</option>
                  <option value="WEEKS">Settimane</option>
                  <option value="MONTHS">Mesi</option>
                  <option value="YEARS">Anni</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-600">Note</span>
                <input
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2"
                  value={createForm.notes}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>

              <div />

              {billingPreview && (
                <div className="col-span-full rounded-md border border-zinc-200 bg-white p-3 text-sm">
                  <p>
                    <strong>Importo fattura di oggi:</strong>{" "}
                    {new Intl.NumberFormat("it-IT", {
                      style: "currency",
                      currency: billingPreview.currency,
                    }).format(billingPreview.amount)}
                  </p>
                  <p>
                    <strong>Quantità:</strong> {Number(createForm.quantity) > 0 ? Number(createForm.quantity) : 1}
                  </p>
                  <p>
                    <strong>Data partenza (prima fattura):</strong>{" "}
                    {billingPreview.todayInvoiceDate.toLocaleDateString("it-IT")}
                  </p>
                  <p>
                    <strong>Prossima fattura:</strong>{" "}
                    {billingPreview.nextInvoiceDate.toLocaleDateString("it-IT")}
                  </p>
                </div>
              )}

              <button className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white" type="submit">
                Salva abbonamento
              </button>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 bg-violet-50 px-4 py-3 text-violet-800">
            <h2 className="text-lg font-semibold">Lista Abbonamenti (compressa per cliente)</h2>
          </div>

          {loading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Caricamento...</p>
          ) : subscriptionsByCustomer.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Nessun abbonamento presente.</p>
          ) : (
            <div className="divide-y divide-zinc-200">
              {subscriptionsByCustomer.map((group) => {
                const isExpanded = expandedCustomers[group.customerId] ?? false;

                return (
                  <div key={group.customerId} className="bg-white">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50"
                      onClick={() =>
                        setExpandedCustomers((prev) => ({
                          ...prev,
                          [group.customerId]: !isExpanded,
                        }))
                      }
                    >
                      <span className="font-medium text-zinc-900">{group.customerName}</span>
                      <span className="text-sm text-zinc-600">
                        {group.items.length} abbonamenti {isExpanded ? "▲" : "▼"}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="overflow-auto border-t border-zinc-200">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr>
                              <th className="px-4 py-2">Servizio</th>
                              <th className="px-4 py-2">Stato</th>
                              <th className="px-4 py-2">Ciclicità</th>
                              <th className="px-4 py-2">Quantità</th>
                              <th className="px-4 py-2">Costo cliente</th>
                              <th className="px-4 py-2">Totale cliente</th>
                              <th className="px-4 py-2">Durata</th>
                              <th className="px-4 py-2">Prossima fattura</th>
                              <th className="px-4 py-2">Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((subscription) => (
                              <tr key={subscription.id} className="border-t border-zinc-200 align-top">
                                <td className="px-4 py-2">
                                  {editingId === subscription.id ? (
                                    <div className="flex flex-col gap-2">
                                      <span className="font-medium text-zinc-900">{subscription.plan.name}</span>
                                      <label className="flex flex-col gap-1 text-xs text-zinc-600">
                                        <span>Note</span>
                                        <input
                                          className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                                          value={editForm.notes}
                                          onChange={(event) =>
                                            setEditForm((prev) => ({ ...prev, notes: event.target.value }))
                                          }
                                        />
                                      </label>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col gap-1">
                                      <span className="font-medium text-zinc-900">{subscription.plan.name}</span>
                                      <span className="text-xs text-zinc-600">
                                        Note: {subscription.notes || "-"}
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {editingId === subscription.id ? (
                                    <div className="flex flex-col gap-2">
                                      <select
                                        className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                                        value={editForm.status}
                                        onChange={(event) =>
                                          setEditForm((prev) => ({ ...prev, status: event.target.value as SubscriptionStatus }))
                                        }
                                      >
                                        <option value="ACTIVE">Attivo</option>
                                        <option value="PAUSED">In pausa</option>
                                        <option value="CANCELED">Cancellato</option>
                                      </select>
                                      {subscription.status !== "ACTIVE" && editForm.status === "ACTIVE" && (
                                        <label className="flex flex-col gap-1 text-xs text-zinc-600">
                                          <span>Data prima fattura attivazione</span>
                                          <input
                                            className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                                            type="date"
                                            value={editForm.startDate}
                                            onChange={(event) =>
                                              setEditForm((prev) => ({ ...prev, startDate: event.target.value }))
                                            }
                                            required
                                          />
                                        </label>
                                      )}
                                      <label className="flex flex-col gap-1 text-xs text-zinc-600">
                                        <span>Data partenza abbonamento (prima fattura)</span>
                                        <input
                                          className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                                          type="date"
                                          value={editForm.startDate}
                                          onChange={(event) =>
                                            setEditForm((prev) => ({ ...prev, startDate: event.target.value }))
                                          }
                                          required
                                        />
                                      </label>
                                    </div>
                                  ) : (
                                    <span
                                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                                        subscription.status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500"
                                      }`}
                                      title={subscription.status === "ACTIVE" ? "Attivo" : "Non attivo"}
                                      aria-label={subscription.status === "ACTIVE" ? "Attivo" : "Non attivo"}
                                    />
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {editingId === subscription.id ? (
                                    <select
                                      className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                                      value={editForm.billingCycle}
                                      onChange={(event) =>
                                        setEditForm((prev) => ({ ...prev, billingCycle: event.target.value as BillingCycle }))
                                      }
                                    >
                                      <option value="MONTHLY">Mensile</option>
                                      <option value="QUARTERLY">Trimestrale</option>
                                      <option value="SEMIANNUAL">Semestrale</option>
                                      <option value="ANNUAL">Annuale</option>
                                    </select>
                                  ) : (
                                    billingCycleLabels[subscription.billingCycle || subscription.plan.billingCycle]
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {editingId === subscription.id ? (
                                    <input
                                      className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1"
                                      type="number"
                                      min={1}
                                      value={editForm.quantity}
                                      onChange={(event) =>
                                        setEditForm((prev) => ({ ...prev, quantity: event.target.value }))
                                      }
                                    />
                                  ) : (
                                    subscription.quantity
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {currencyFormatter.format(getCustomerUnitPrice(subscription))}
                                </td>
                                <td className="px-4 py-2">
                                  {currencyFormatter.format(
                                    getCustomerTotalPrice(
                                      subscription,
                                      editingId === subscription.id
                                        ? Math.max(1, Number(editForm.quantity) || 1)
                                        : subscription.quantity,
                                    ),
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {editingId === subscription.id ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1"
                                        type="number"
                                        min={1}
                                        value={editForm.durationValue}
                                        onChange={(event) =>
                                          setEditForm((prev) => ({ ...prev, durationValue: event.target.value }))
                                        }
                                      />
                                      <select
                                        className="rounded-md border border-zinc-300 bg-white px-2 py-1"
                                        value={editForm.durationUnit}
                                        onChange={(event) =>
                                          setEditForm((prev) => ({ ...prev, durationUnit: event.target.value as DurationUnit }))
                                        }
                                      >
                                        <option value="DAYS">Giorni</option>
                                        <option value="WEEKS">Settimane</option>
                                        <option value="MONTHS">Mesi</option>
                                        <option value="YEARS">Anni</option>
                                      </select>
                                    </div>
                                  ) : subscription.durationValue && subscription.durationUnit ? (
                                    `${subscription.durationValue} ${subscription.durationUnit}`
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-4 py-2">
                                  {new Date(subscription.nextBillingDate).toLocaleDateString("it-IT")}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap gap-2">
                                      {editingId === subscription.id ? (
                                        <>
                                          <button
                                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                                            type="button"
                                            onClick={() => void onSaveEdit(subscription)}
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
                                          onClick={() => onStartEdit(subscription)}
                                        >
                                          Modifica
                                        </button>
                                      )}
                                      <button
                                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-red-700"
                                        type="button"
                                        onClick={() => void onDeleteSubscription(subscription.id)}
                                      >
                                        Cancella
                                      </button>
                                      <button
                                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                                        type="button"
                                        onClick={() => void onCreateAndSendCount(subscription.id)}
                                        disabled={sendingCountForId === subscription.id}
                                      >
                                        {sendingCountForId === subscription.id ? "Invio..." : "Crea e invia conteggio"}
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <input
                                        className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"
                                        type="number"
                                        min={1900}
                                        max={2100}
                                        placeholder="Anno"
                                        value={retroYearById[subscription.id] || ""}
                                        onChange={(event) =>
                                          setRetroYearById((prev) => ({ ...prev, [subscription.id]: event.target.value }))
                                        }
                                      />
                                      <button
                                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                                        type="button"
                                        onClick={() => void onSendRetroactive(subscription.id)}
                                        disabled={sendingRetroForId === subscription.id}
                                      >
                                        {sendingRetroForId === subscription.id ? "Invio..." : "Invio abbonamento retroattivo"}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
