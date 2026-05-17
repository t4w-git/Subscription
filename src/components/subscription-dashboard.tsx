"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BillingCycle = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL";
type DurationUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";
type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";
type InvoiceStatus = "PENDING" | "PAID" | "OVERDUE";
type ReminderStatus = "PENDING" | "SENT" | "FAILED";
type ExpenseFrequency = "ONE_TIME" | "MONTHLY" | "QUARTERLY" | "ANNUAL";
type ProjectStatus = "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELED";
type ProjectMilestoneStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";

type Supplier = {
  id: string;
  name: string;
};

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
  supplier?: Supplier | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  subscription?: {
    customer: Customer;
    plan: Plan;
  };
};

type Subscription = {
  id: string;
  customerId: string;
  planId: string;
  startDate: string;
  billingCycle: BillingCycle | null;
  quantity: number;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  nextBillingDate: string;
  status: SubscriptionStatus;
  notes: string | null;
  customer: Customer;
  plan: Plan;
};

type Reminder = {
  id: string;
  customerId: string | null;
  subscriptionId: string | null;
  email: string;
  subject: string;
  message: string;
  remindAt: string;
  status: ReminderStatus;
};

type Expense = {
  id: string;
  supplierId: string | null;
  supplier: Supplier | null;
  serviceName: string;
  amount: number;
  frequency: ExpenseFrequency;
  expenseDate: string;
};

type ProjectMilestone = {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  status: ProjectMilestoneStatus;
  position: number;
};

type Project = {
  id: string;
  customerId: string | null;
  customer: Customer | null;
  name: string;
  description: string | null;
  startDate: string | null;
  deadline: string | null;
  status: ProjectStatus;
  progress: number;
  milestones: ProjectMilestone[];
};

type OverviewResponse = {
  customers: Customer[];
  suppliers: Supplier[];
  plans: Plan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  expenses: Expense[];
  projects: Project[];
  reminders: Reminder[];
  metrics: {
    totalCustomers: number;
    activeSubscriptions: number;
    upcomingRenewals: number;
    pendingInvoices: number;
    monthlyRecurringRevenue: number;
    monthlySupplierCosts: number;
    monthlyExpenses: number;
    grossProfitMonthly: number;
    marginPercent: number;
    totalProjects: number;
    activeProjects: number;
    projectDeadlinesSoon: number;
    projectOverdue: number;
  };
};

const statusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: "Attivo",
  PAUSED: "In pausa",
  CANCELED: "Cancellato",
};

const reminderStatusLabels: Record<ReminderStatus, string> = {
  PENDING: "In attesa",
  SENT: "Inviato",
  FAILED: "Fallito",
};

const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Pianificazione",
  IN_PROGRESS: "In corso",
  ON_HOLD: "In pausa",
  COMPLETED: "Completato",
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

export function SubscriptionDashboard() {
  const [data, setData] = useState<OverviewResponse | null>(null);
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

  const getAnnualTotal = (subscription: Subscription) => {
    const pricePerCycle = getPricePerCycle(subscription);

    return pricePerCycle;
  };

  const getProviderCostPerCycle = (subscription: Subscription) => {
    const providerCost = subscription.plan.providerCost || 0;
    const planMonths = billingCycleMonths[subscription.plan.billingCycle];
    const effectiveCycle = getEffectiveCycle(subscription);
    const effectiveMonths = billingCycleMonths[effectiveCycle];

    return (providerCost / planMonths) * effectiveMonths * subscription.quantity;
  };

  const getCustomerAnnualBilled = (customerId: string) => {
    return data?.subscriptions
      .filter(
        (subscription) =>
          subscription.customerId === customerId && subscription.status === "ACTIVE",
      )
      .reduce((total, subscription) => total + getAnnualTotal(subscription), 0) ?? 0;
  };

  const getExpenseMonthlyImpact = (expense: Expense) => {
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
      expenseDate.getMonth() === now.getMonth() &&
      expenseDate.getFullYear() === now.getFullYear();

    return sameMonth ? expense.amount : 0;
  };

  const getExpenseAnnualImpact = (expense: Expense) => {
    if (expense.frequency === "MONTHLY") {
      return expense.amount * 12;
    }

    if (expense.frequency === "QUARTERLY") {
      return expense.amount * 4;
    }

    if (expense.frequency === "ANNUAL") {
      return expense.amount;
    }

    const now = new Date();
    const expenseDate = new Date(expense.expenseDate);
    const sameYear = expenseDate.getFullYear() === now.getFullYear();

    return sameYear ? expense.amount : 0;
  };

  const getSubscriptionsOrderedByDate = () => {
    if (!data) return [];
    const now = new Date();
    return data.subscriptions.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
  };

  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/overview", { cache: "no-store" });
        if (!response.ok) {
          throw new Error();
        }
        const result = (await response.json()) as OverviewResponse;
        setData(result);
      } catch {
        setError("Impossibile caricare i dati dashboard");
      } finally {
        setLoading(false);
      }
    }

    void fetchOverview();
  }, []);

  return (
    <main className="min-h-screen bg-white p-6 text-zinc-900 md:p-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-zinc-600">Panoramica generale. Clicca sull&apos;intestazione di sezione per entrare nella pagina dedicata.</p>
        </header>

        {error && (
          <p className="rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm text-zinc-800">
            {error}
          </p>
        )}

        {loading && <p className="text-sm text-zinc-500">Caricamento dati...</p>}

        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <MetricCard title="Clienti" value={String(data.metrics.totalCustomers)} />
              <MetricCard title="Abbonamenti attivi" value={String(data.metrics.activeSubscriptions)} />
              <MetricCard title="Rinnovi (30 giorni)" value={String(data.metrics.upcomingRenewals)} />
              <MetricCard title="Fatture aperte" value={String(data.metrics.pendingInvoices)} />
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <MetricCard title="Progetti totali" value={String(data.metrics.totalProjects)} />
              <MetricCard title="Progetti attivi" value={String(data.metrics.activeProjects)} />
              <MetricCard title="Deadline entro 14 giorni" value={String(data.metrics.projectDeadlinesSoon)} />
              <MetricCard title="Progetti in ritardo" value={String(data.metrics.projectOverdue)} />
            </section>

            <SimpleTable title="Progetti" titleHref="/progetti" headerClass="bg-indigo-50 text-indigo-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Progetto</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Deadline</th>
                    <th className="px-4 py-2">Stato</th>
                    <th className="px-4 py-2">Avanzamento</th>
                    <th className="px-4 py-2">Milestone</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((project) => (
                    <tr key={project.id} className="border-t border-zinc-200">
                      <td className="px-4 py-2">{project.name}</td>
                      <td className="px-4 py-2">{project.customer?.name || "-"}</td>
                      <td className="px-4 py-2">
                        {project.deadline ? new Date(project.deadline).toLocaleDateString("it-IT") : "-"}
                      </td>
                      <td className="px-4 py-2">{projectStatusLabels[project.status]}</td>
                      <td className="px-4 py-2">{project.progress}%</td>
                      <td className="px-4 py-2">{project.milestones.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SimpleTable>

            <SimpleTable title="Clienti" titleHref="/clienti" headerClass="bg-sky-50 text-sky-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Nome</th>
                    <th className="px-4 py-2">Abbonamenti attivi</th>
                    <th className="px-4 py-2">Totale annuale fatturato</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((customer) => (
                    <tr key={customer.id} className="border-t border-zinc-200">
                      <td className="px-4 py-2">{customer.name}</td>
                      <td className="px-4 py-2">
                        {
                          data.subscriptions.filter(
                            (subscription) =>
                              subscription.customerId === customer.id && subscription.status === "ACTIVE",
                          ).length
                        }
                      </td>
                      <td className="px-4 py-2">
                        {currencyFormatter.format(getCustomerAnnualBilled(customer.id))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SimpleTable>

            <SimpleTable title="Servizi" titleHref="/servizi/modifica" headerClass="bg-amber-50 text-amber-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Servizio</th>
                    <th className="px-4 py-2">Fornitore</th>
                    <th className="px-4 py-2">Costo al cliente</th>
                    <th className="px-4 py-2">Costo a noi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plans.map((plan) => (
                    <tr key={plan.id} className="border-t border-zinc-200">
                      <td className="px-4 py-2">{plan.name}</td>
                      <td className="px-4 py-2">{plan.supplier?.name || "-"}</td>
                      <td className="px-4 py-2">{currencyFormatter.format(plan.price)}</td>
                      <td className="px-4 py-2">
                        {plan.providerCost !== null ? currencyFormatter.format(plan.providerCost) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SimpleTable>

            <SimpleTable title="Abbonamenti" titleHref="/abbonamenti/modifica" headerClass="bg-violet-50 text-violet-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Servizio</th>
                    <th className="px-4 py-2">Quantità</th>
                    <th className="px-4 py-2">Ciclicità</th>
                    <th className="px-4 py-2">Prezzo</th>
                    <th className="px-4 py-2">Totale annuo</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {data.subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="border-t border-zinc-200">
                      <td className="px-4 py-2">{subscription.customer.name}</td>
                      <td className="px-4 py-2">{subscription.plan.name}</td>
                      <td className="px-4 py-2">{subscription.quantity}</td>
                      <td className="px-4 py-2">{billingCycleLabels[getEffectiveCycle(subscription)]}</td>
                      <td className="px-4 py-2">{currencyFormatter.format(getPricePerCycle(subscription))}</td>
                      <td className="px-4 py-2">{currencyFormatter.format(getAnnualTotal(subscription))}</td>
                      <td className="px-4 py-2">{statusLabels[subscription.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SimpleTable>

            <SimpleTable
              title="Scadenze entro 30 giorni"
              titleHref="/abbonamenti/scadenze"
              headerClass="bg-orange-50 text-orange-800"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Data scadenza</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2">Servizio</th>
                    <th className="px-4 py-2">Prezzo</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const now = new Date();
                    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    return getSubscriptionsOrderedByDate()
                      .filter((subscription) => {
                        const nextBillingDate = new Date(subscription.nextBillingDate);
                        const daysUntilBilling = Math.floor(
                          (nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                        );
                        return nextBillingDate <= thirtyDaysFromNow && daysUntilBilling >= 0;
                      })
                      .map((subscription) => {
                        const nextBillingDate = new Date(subscription.nextBillingDate);
                        const daysUntilBilling = Math.floor(
                          (nextBillingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                        );
                        let dateRowClass = "";
                        if (daysUntilBilling < 0) {
                          dateRowClass = "bg-red-50 text-red-700 font-semibold";
                        } else if (daysUntilBilling <= 7) {
                          dateRowClass = "bg-orange-100 text-orange-700 font-semibold";
                        } else if (daysUntilBilling <= 30) {
                          dateRowClass = "bg-yellow-50 text-yellow-700";
                        }
                        return (
                          <tr key={subscription.id} className="border-t border-zinc-200">
                            <td className={`px-4 py-2 ${dateRowClass}`}>
                              {nextBillingDate.toLocaleDateString("it-IT")}
                              {daysUntilBilling !== undefined && (
                                <>
                                  <br />
                                  <span className="text-xs">
                                    {daysUntilBilling < 0
                                      ? `Scaduto da ${Math.abs(daysUntilBilling)} giorni`
                                      : daysUntilBilling === 0
                                        ? "Oggi"
                                        : `Tra ${daysUntilBilling} giorni`}
                                  </span>
                                </>
                              )}
                            </td>
                            <td className="px-4 py-2">{subscription.customer.name}</td>
                            <td className="px-4 py-2">{subscription.plan.name}</td>
                            <td className="px-4 py-2">{currencyFormatter.format(getPricePerCycle(subscription))}</td>
                            <td className="px-4 py-2">{statusLabels[subscription.status]}</td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </SimpleTable>

            <SimpleTable
              title="Automazioni"
              titleHref="/automazione/configurazione"
              headerClass="bg-emerald-50 text-emerald-800"
            >
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-2">Destinatario</th>
                    <th className="px-4 py-2">Invio</th>
                    <th className="px-4 py-2">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reminders.map((reminder) => (
                    <tr key={reminder.id} className="border-t border-zinc-200">
                      <td className="px-4 py-2">{reminder.email}</td>
                      <td className="px-4 py-2">{new Date(reminder.remindAt).toLocaleString("it-IT")}</td>
                      <td className="px-4 py-2">{reminderStatusLabels[reminder.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SimpleTable>

            <SimpleTable title="Costi" titleHref="/costi" headerClass="bg-rose-50 text-rose-800">
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
                      <td className="px-4 py-2">
                        {expense.frequency === "MONTHLY"
                          ? "Mensile"
                          : expense.frequency === "QUARTERLY"
                            ? "Trimestrale"
                          : expense.frequency === "ANNUAL"
                            ? "Annuale"
                            : "Una tantum"}
                      </td>
                      <td className="px-4 py-2">{currencyFormatter.format(expense.amount)}</td>
                      <td className="px-4 py-2">{currencyFormatter.format(getExpenseMonthlyImpact(expense))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SimpleTable>
          </>
        )}
      </div>
    </main>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SimpleTable({
  title,
  titleHref,
  headerClass,
  children,
}: {
  title: string;
  titleHref?: string;
  headerClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200">
      <div className={`flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 ${headerClass}`}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {titleHref && (
          <Link
            href={titleHref}
            className="rounded-md border border-current px-3 py-1 text-xs font-medium uppercase tracking-wide transition hover:bg-white/60"
          >
            Vai alla pagina
          </Link>
        )}
      </div>
      <div className="max-h-[420px] overflow-auto">{children}</div>
    </div>
  );
}
