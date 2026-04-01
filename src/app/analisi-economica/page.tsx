"use client";

import { useEffect, useMemo, useState } from "react";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";
type ExpenseFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL";

type Supplier = {
  id: string;
  name: string;
};

type Plan = {
  id: string;
  name: string;
  price: number;
  billingCycle: BillingCycle;
  providerCost: number | null;
};

type Subscription = {
  id: string;
  customer: {
    name: string;
  };
  plan: Plan;
  billingCycle: BillingCycle | null;
  quantity: number;
  status: SubscriptionStatus;
};

type Expense = {
  id: string;
  supplier: Supplier | null;
  serviceName: string;
  amount: number;
  frequency: ExpenseFrequency;
  expenseDate: string;
};

type RevenueByService = {
  planId: string;
  planName: string;
  activeCount: number;
  monthlyRevenue: number;
  annualReferenceRevenue: number;
  monthlySupplierCosts: number;
};

type OverviewResponse = {
  subscriptions: Subscription[];
  expenses: Expense[];
  revenueByService: RevenueByService[];
  metrics: {
    monthlyRecurringRevenue: number;
    monthlySupplierCosts: number;
    monthlyExpenses: number;
    grossProfitMonthly: number;
    marginPercent: number;
  };
};

const cycleLabels: Record<BillingCycle, string> = {
  MONTHLY: "Mensile",
  QUARTERLY: "Trimestrale",
  SEMIANNUAL: "Semestrale",
  ANNUAL: "Annuale",
};

const cycleMonths: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

function expenseMonthlyImpact(expense: Expense) {
  if (expense.frequency === "MONTHLY") {
    return expense.amount;
  }

  if (expense.frequency === "QUARTERLY") {
    return expense.amount / 3;
  }

  if (expense.frequency === "ANNUAL") {
    return expense.amount / 12;
  }

  const now = new Date();
  const expenseDate = new Date(expense.expenseDate);
  const sameMonth =
    now.getMonth() === expenseDate.getMonth() &&
    now.getFullYear() === expenseDate.getFullYear();

  return sameMonth ? expense.amount : 0;
}

export default function AnalisiEconomicaPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
      }),
    [],
  );

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/overview", { cache: "no-store" });
        if (!response.ok) {
          throw new Error();
        }
        const payload = (await response.json()) as OverviewResponse;
        setData(payload);
      } catch {
        setError("Impossibile caricare l'analisi economica");
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, []);

  const activeSubscriptions = (data?.subscriptions || []).filter((subscription) => subscription.status === "ACTIVE");

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header>
          <h1 className="text-3xl font-bold">Analisi economica</h1>
          <p className="text-sm text-zinc-600">Dettaglio analitico di ricavi, costi e formula di calcolo del margine</p>
        </header>

        {error && <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">{error}</p>}
        {loading && <p className="text-sm text-zinc-500">Caricamento...</p>}

        {data && (
          <>
            <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
              <h2 className="text-base font-semibold text-zinc-900">Come viene effettuato il conteggio</h2>
              <ul className="mt-2 space-y-1">
                <li>Ricavo mensile = somma dei ricavi mensili equivalenti di tutti gli abbonamenti attivi</li>
                <li>Costo fornitori mensile = somma dei costi mensili equivalenti dei servizi attivi</li>
                <li>Costi generici mensili = somma costi periodici + quota mensile dei costi trimestrali/annuali</li>
                <li>Guadagno mensile = ricavo mensile - costo fornitori mensile - costi generici mensili</li>
                <li>Margine % = guadagno mensile / ricavo mensile * 100</li>
              </ul>
            </section>

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Metric title="Ricavo mensile" value={currency.format(data.metrics.monthlyRecurringRevenue)} />
              <Metric title="Costi fornitori mensili" value={currency.format(data.metrics.monthlySupplierCosts)} />
              <Metric title="Costi generici mensili" value={currency.format(data.metrics.monthlyExpenses)} />
              <Metric title="Guadagno mensile" value={currency.format(data.metrics.grossProfitMonthly)} />
              <Metric title="Margine" value={`${data.metrics.marginPercent.toFixed(1)}%`} />
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 bg-violet-50 px-4 py-3">
                <h2 className="text-lg font-semibold text-violet-800">Dettaglio ricavi abbonamenti attivi</h2>
              </div>
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Cliente</th>
                      <th className="px-4 py-2">Servizio</th>
                      <th className="px-4 py-2">Ciclicità</th>
                      <th className="px-4 py-2">Quantità</th>
                      <th className="px-4 py-2">Ricavo annuo rif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubscriptions.map((subscription) => {
                      const planMonths = cycleMonths[subscription.plan.billingCycle];
                      const effectiveCycle = subscription.billingCycle || subscription.plan.billingCycle;
                      const billedAmount = (subscription.plan.price / planMonths) * cycleMonths[effectiveCycle];
                      const annualReference = billedAmount * subscription.quantity;

                      return (
                        <tr key={subscription.id} className="border-t border-zinc-200">
                          <td className="px-4 py-2">{subscription.customer.name}</td>
                          <td className="px-4 py-2">{subscription.plan.name}</td>
                          <td className="px-4 py-2">{cycleLabels[effectiveCycle]}</td>
                          <td className="px-4 py-2">{subscription.quantity}</td>
                          <td className="px-4 py-2">{currency.format(annualReference)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 bg-green-50 px-4 py-3">
                <h2 className="text-lg font-semibold text-green-800">Ricavi suddivisi per servizi</h2>
              </div>
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Servizio</th>
                      <th className="px-4 py-2">Abbonamenti attivi</th>
                      <th className="px-4 py-2">Ricavo mensile</th>
                      <th className="px-4 py-2">Ricavo annuo rif.</th>
                      <th className="px-4 py-2">Costi fornitori mensili</th>
                      <th className="px-4 py-2">Margine mensile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenueByService.map((service) => {
                      const monthlyMargin = service.monthlyRevenue - service.monthlySupplierCosts;
                      const marginPercent =
                        service.monthlyRevenue > 0
                          ? (monthlyMargin / service.monthlyRevenue) * 100
                          : 0;

                      return (
                        <tr key={service.planId} className="border-t border-zinc-200">
                          <td className="px-4 py-2 font-medium">{service.planName}</td>
                          <td className="px-4 py-2">{service.activeCount}</td>
                          <td className="px-4 py-2">{currency.format(service.monthlyRevenue)}</td>
                          <td className="px-4 py-2">{currency.format(service.annualReferenceRevenue)}</td>
                          <td className="px-4 py-2">{currency.format(service.monthlySupplierCosts)}</td>
                          <td className="px-4 py-2">
                            <span className="font-medium text-green-700">
                              {currency.format(monthlyMargin)}
                            </span>
                            <span className="ml-1 text-zinc-500">({marginPercent.toFixed(1)}%)</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 bg-amber-50 px-4 py-3">
                <h2 className="text-lg font-semibold text-amber-800">Dettaglio costi fornitori (da abbonamenti attivi)</h2>
              </div>
              <div className="max-h-[380px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Cliente</th>
                      <th className="px-4 py-2">Servizio</th>
                      <th className="px-4 py-2">Costo unitario</th>
                      <th className="px-4 py-2">Quantità</th>
                      <th className="px-4 py-2">Costo mensile eq.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubscriptions.map((subscription) => {
                      const providerCost = subscription.plan.providerCost || 0;
                      const planMonths = cycleMonths[subscription.plan.billingCycle];
                      const effectiveCycle = subscription.billingCycle || subscription.plan.billingCycle;
                      const billedProviderCost = (providerCost / planMonths) * cycleMonths[effectiveCycle];
                      const monthly = (billedProviderCost * subscription.quantity) / cycleMonths[effectiveCycle];

                      return (
                        <tr key={subscription.id} className="border-t border-zinc-200">
                          <td className="px-4 py-2">{subscription.customer.name}</td>
                          <td className="px-4 py-2">{subscription.plan.name}</td>
                          <td className="px-4 py-2">{currency.format(providerCost)}</td>
                          <td className="px-4 py-2">{subscription.quantity}</td>
                          <td className="px-4 py-2">{currency.format(monthly)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="border-b border-zinc-200 bg-rose-50 px-4 py-3">
                <h2 className="text-lg font-semibold text-rose-800">Dettaglio costi generici</h2>
              </div>
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="px-4 py-2">Descrizione</th>
                      <th className="px-4 py-2">Fornitore</th>
                      <th className="px-4 py-2">Frequenza</th>
                      <th className="px-4 py-2">Importo</th>
                      <th className="px-4 py-2">Impatto mensile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expenses.map((expense) => (
                      <tr key={expense.id} className="border-t border-zinc-200">
                        <td className="px-4 py-2">{expense.serviceName}</td>
                        <td className="px-4 py-2">{expense.supplier?.name || "Generico"}</td>
                        <td className="px-4 py-2">{expense.frequency}</td>
                        <td className="px-4 py-2">{currency.format(expense.amount)}</td>
                        <td className="px-4 py-2">{currency.format(expenseMonthlyImpact(expense))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
    </div>
  );
}
