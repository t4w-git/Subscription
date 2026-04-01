"use client";

import { useEffect, useState } from "react";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";

type Subscription = {
  id: string;
  customer: {
    name: string;
  };
  plan: {
    name: string;
    billingCycle: BillingCycle;
    price: number;
  };
  billingCycle: BillingCycle | null;
  quantity: number;
  startDate: string;
  nextBillingDate: string;
  status: SubscriptionStatus;
  notes: string | null;
};

const cycleLabels: Record<BillingCycle, string> = {
  MONTHLY: "Mensile",
  QUARTERLY: "Trimestrale",
  SEMIANNUAL: "Semestrale",
  ANNUAL: "Annuale",
};

const statusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Attivo",
  PAUSED: "In pausa",
  CANCELED: "Cancellato",
};

export default function AbbonamentiExportPdfPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubscriptions() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/subscriptions", { cache: "no-store" });
        if (!response.ok) {
          throw new Error();
        }

        const payload = (await response.json()) as Subscription[];
        setSubscriptions(payload);
      } catch {
        setError("Impossibile caricare gli abbonamenti per l'esportazione PDF");
      } finally {
        setLoading(false);
      }
    }

    void fetchSubscriptions();
  }, []);

  return (
    <>
      <style jsx global>{`
        @media print {
          header.border-b.border-zinc-200.bg-white {
            display: none !important;
          }
        }
      `}</style>
      <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10 print:p-0 print:text-black">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 print:max-w-none">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <h1 className="text-2xl font-bold">Esportazione PDF - Abbonamenti e Clienti</h1>
          <button
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
            type="button"
            onClick={() => window.print()}
          >
            Stampa / Salva PDF
          </button>
        </div>

        <div className="hidden print:block">
          <h1 className="text-xl font-bold">Report abbonamenti e clienti</h1>
          <p className="text-sm">Generato il {new Date().toLocaleString("it-IT")}</p>
        </div>

        {error && <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm">{error}</p>}
        {loading && <p className="text-sm text-zinc-500">Caricamento dati...</p>}

        {!loading && !error && (
          <section className="overflow-hidden rounded-lg border border-zinc-200 print:rounded-none print:border-0">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-zinc-50 print:bg-white">
                  <th className="border border-zinc-200 px-3 py-2">Cliente</th>
                  <th className="border border-zinc-200 px-3 py-2">Servizio</th>
                  <th className="border border-zinc-200 px-3 py-2">Tipo di fatturazione</th>
                  <th className="border border-zinc-200 px-3 py-2">Prezzo servizio</th>
                  <th className="border border-zinc-200 px-3 py-2">Quantità</th>
                  <th className="border border-zinc-200 px-3 py-2">Prossima fattura</th>
                  <th className="border border-zinc-200 px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td className="border border-zinc-200 px-3 py-2">{subscription.customer.name}</td>
                    <td className="border border-zinc-200 px-3 py-2">{subscription.plan.name}</td>
                    <td className="border border-zinc-200 px-3 py-2">
                      {cycleLabels[subscription.billingCycle || subscription.plan.billingCycle]}
                    </td>
                    <td className="border border-zinc-200 px-3 py-2">
                      {new Intl.NumberFormat("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      }).format(subscription.plan.price)}
                    </td>
                    <td className="border border-zinc-200 px-3 py-2">{subscription.quantity}</td>
                    <td className="border border-zinc-200 px-3 py-2">
                      {new Date(subscription.nextBillingDate).toLocaleDateString("it-IT")}
                    </td>
                    <td className="border border-zinc-200 px-3 py-2">{subscription.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        </div>
      </main>
    </>
  );
}
