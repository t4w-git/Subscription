"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
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
};

type Subscription = {
  id: string;
  customerId: string;
  planId: string;
  startDate: string;
  billingCycle: BillingCycle | null;
  quantity: number;
  durationValue: number | null;
  nextBillingDate: string;
  status: SubscriptionStatus;
  notes: string | null;
  customer: Customer;
  plan: Plan;
};

type OverviewResponse = {
  subscriptions: Subscription[];
};

const statusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Attivo",
  PAUSED: "In pausa",
  CANCELED: "Cancellato",
};

const billingCycleLabels: Record<BillingCycle, string> = {
  MONTHLY: "Mensile",
  QUARTERLY: "Trimestrale",
  SEMIANNUAL: "Semestrale",
  ANNUAL: "Annuale",
};

const billingCycleMonths: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export default function ScadenzeAbbonamentiPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getPricePerCycle = (subscription: Subscription) => {
    const planMonths = billingCycleMonths[subscription.plan.billingCycle];
    const effectiveCycle = getEffectiveCycle(subscription);
    const effectiveMonths = billingCycleMonths[effectiveCycle];

    return (subscription.plan.price / planMonths) * effectiveMonths * subscription.quantity;
  };

  useEffect(() => {
    async function fetchSubscriptions() {
      try {
        const response = await fetch("/api/overview");
        if (!response.ok) {
          throw new Error();
        }
        const result = (await response.json()) as OverviewResponse;
        setSubscriptions(result.subscriptions);
      } catch {
        setError("Impossibile caricare i dati delle scadenze");
      } finally {
        setLoading(false);
      }
    }

    void fetchSubscriptions();
  }, []);

  const subscriptionsOrderedByDate = useMemo(() => {
    if (!subscriptions) return [];
    return subscriptions.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
  }, [subscriptions]);

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Scadenze Abbonamenti</h1>
            <Link
              href="/abbonamenti/modifica"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Torna agli abbonamenti
            </Link>
          </div>
          <p className="text-sm text-zinc-600">Lista completa di tutte le scadenze ordinate per data</p>
        </header>

        {error && (
          <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">
            {error}
          </p>
        )}

        {loading && <p className="text-sm text-zinc-500">Caricamento dati...</p>}

        {!loading && !error && (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 bg-orange-50 px-4 py-3">
              <h2 className="text-lg font-semibold text-orange-800">Scadenze per data</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 font-semibold text-zinc-700">Data scadenza</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Cliente</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Servizio</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Ciclicità</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Prezzo</th>
                    <th className="px-4 py-3 font-semibold text-zinc-700">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionsOrderedByDate.map((subscription) => {
                    const now = new Date();
                    const nextBillingDate = new Date(subscription.nextBillingDate);
                    const daysUntilBilling = Math.floor(
                      (nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    let dateRowClass = "";
                    if (daysUntilBilling < 0) {
                      dateRowClass = "bg-red-50";
                    } else if (daysUntilBilling <= 7) {
                      dateRowClass = "bg-orange-100";
                    } else if (daysUntilBilling <= 30) {
                      dateRowClass = "bg-yellow-50";
                    }

                    return (
                      <tr key={subscription.id} className={`border-t border-zinc-200 ${dateRowClass}`}>
                        <td className="px-4 py-3 font-medium">
                          {nextBillingDate.toLocaleDateString("it-IT")}
                          <br />
                          <span className="text-xs text-zinc-600">
                            {daysUntilBilling < 0
                              ? `Scaduto da ${Math.abs(daysUntilBilling)} giorni`
                              : daysUntilBilling === 0
                                ? "Oggi"
                                : `Tra ${daysUntilBilling} giorni`}
                          </span>
                        </td>
                        <td className="px-4 py-3">{subscription.customer.name}</td>
                        <td className="px-4 py-3">{subscription.plan.name}</td>
                        <td className="px-4 py-3">{billingCycleLabels[getEffectiveCycle(subscription)]}</td>
                        <td className="px-4 py-3">{currencyFormatter.format(getPricePerCycle(subscription))}</td>
                        <td className="px-4 py-3">{statusLabels[subscription.status]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
