import { NextResponse } from "next/server";
import { isBefore, addDays, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import { convertBillingAmount, monthlyValue } from "@/lib/billing";
import { processDueReminders } from "@/lib/reminders";
import { syncProjectDeadlineReminders } from "@/lib/project-reminders";
import { serializeInvoice, serializePlan, serializeSubscription } from "@/lib/serializers";

export async function GET() {
  const projectReminderSync = await syncProjectDeadlineReminders();
  const reminderJob = await processDueReminders();

  const [customers, plans, subscriptions, invoices, reminders, suppliers, expenses, projects] = await Promise.all([
    prisma.customer.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.plan.findMany({
      include: {
        supplier: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscription.findMany({
      include: {
        customer: true,
        plan: {
          include: {
            supplier: true,
          },
        },
        invoices: {
          orderBy: { dueDate: "asc" },
        },
      },
      orderBy: { nextBillingDate: "asc" },
    }),
    prisma.invoice.findMany({
      include: {
        subscription: {
          include: {
            customer: true,
            plan: {
              include: {
                supplier: true,
              },
            },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.reminder.findMany({
      include: {
        customer: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: { remindAt: "asc" },
    }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.expense.findMany({
      include: {
        supplier: true,
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.project.findMany({
      include: {
        customer: true,
        milestones: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const normalizedPlans = plans.map(serializePlan);
  const normalizedSubscriptions = subscriptions.map(serializeSubscription);
  const normalizedInvoices = invoices.map((invoice) => ({
    ...serializeInvoice(invoice),
    subscription: {
      ...invoice.subscription,
      plan: serializePlan(invoice.subscription.plan),
    },
  }));

  const now = new Date();
  const in30Days = addDays(now, 30);

  const activeSubscriptions = normalizedSubscriptions.filter(
    (subscription) => subscription.status === "ACTIVE",
  );

  const upcomingRenewals = activeSubscriptions.filter((subscription) =>
    isBefore(new Date(subscription.nextBillingDate), in30Days),
  ).length;

  const pendingInvoices = normalizedInvoices.filter(
    (invoice) => invoice.status === "PENDING" || invoice.status === "OVERDUE",
  ).length;

  const monthlyRecurringRevenue = activeSubscriptions.reduce((total, subscription) => {
    const effectiveCycle = subscription.billingCycle || subscription.plan.billingCycle;
    const billedAmount = convertBillingAmount(
      subscription.plan.price,
      subscription.plan.billingCycle,
      effectiveCycle,
    );

    return total + monthlyValue(billedAmount * subscription.quantity, effectiveCycle);
  }, 0);

  const monthlySupplierCosts = activeSubscriptions.reduce((total, subscription) => {
    const effectiveCycle = subscription.billingCycle || subscription.plan.billingCycle;
    const providerCost = subscription.plan.providerCost || 0;
    const billedProviderCost = convertBillingAmount(
      providerCost,
      subscription.plan.billingCycle,
      effectiveCycle,
    );

    return total + monthlyValue(billedProviderCost * subscription.quantity, effectiveCycle);
  }, 0);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const monthlyExpenses = expenses.reduce((total, expense) => {
    const amount = Number(expense.amount);
    if (expense.frequency === "MONTHLY") {
      return total + amount;
    }

    if (expense.frequency === "QUARTERLY") {
      return total + amount / 3;
    }

    if (expense.frequency === "ANNUAL") {
      return total + amount / 12;
    }

    if (expense.expenseDate >= monthStart && expense.expenseDate <= monthEnd) {
      return total + amount;
    }

    return total;
  }, 0);

  const grossProfitMonthly = monthlyRecurringRevenue - monthlySupplierCosts - monthlyExpenses;
  const marginPercent =
    monthlyRecurringRevenue > 0
      ? (grossProfitMonthly / monthlyRecurringRevenue) * 100
      : 0;

  const in14Days = addDays(now, 14);
  const activeProjects = projects.filter(
    (project) => project.status === "PLANNING" || project.status === "IN_PROGRESS" || project.status === "ON_HOLD",
  );
  const projectDeadlinesSoon = activeProjects.filter((project) =>
    project.deadline ? isBefore(new Date(project.deadline), in14Days) : false,
  ).length;
  const projectOverdue = activeProjects.filter((project) =>
    project.deadline ? isBefore(new Date(project.deadline), now) : false,
  ).length;

  // Calculate revenue by service
  const revenueByServiceMap = new Map<
    string,
    {
      planId: string;
      planName: string;
      activeCount: number;
      monthlyRevenue: number;
      annualReferenceRevenue: number;
      monthlySupplierCosts: number;
    }
  >();

  for (const subscription of activeSubscriptions) {
    const key = subscription.plan.id;
    const effectiveCycle = subscription.billingCycle || subscription.plan.billingCycle;
    const billedAmount = convertBillingAmount(
      subscription.plan.price,
      subscription.plan.billingCycle,
      effectiveCycle,
    );
    const monthlyValue_ = monthlyValue(billedAmount * subscription.quantity, effectiveCycle);
    const annualReferenceValue = billedAmount * subscription.quantity;

    const providerCost = subscription.plan.providerCost || 0;
    const billedProviderCost = convertBillingAmount(
      providerCost,
      subscription.plan.billingCycle,
      effectiveCycle,
    );
    const monthlySupplierCostsValue = monthlyValue(
      billedProviderCost * subscription.quantity,
      effectiveCycle,
    );

    if (revenueByServiceMap.has(key)) {
      const existing = revenueByServiceMap.get(key)!;
      existing.activeCount += 1;
      existing.monthlyRevenue += monthlyValue_;
      existing.annualReferenceRevenue += annualReferenceValue;
      existing.monthlySupplierCosts += monthlySupplierCostsValue;
    } else {
      revenueByServiceMap.set(key, {
        planId: subscription.plan.id,
        planName: subscription.plan.name,
        activeCount: 1,
        monthlyRevenue: monthlyValue_,
        annualReferenceRevenue: annualReferenceValue,
        monthlySupplierCosts: monthlySupplierCostsValue,
      });
    }
  }

  const revenueByService = Array.from(revenueByServiceMap.values()).sort(
    (a, b) => b.monthlyRevenue - a.monthlyRevenue,
  );

  return NextResponse.json({
    customers,
    suppliers,
    plans: normalizedPlans,
    subscriptions: normalizedSubscriptions,
    invoices: normalizedInvoices,
    expenses: expenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
    })),
    projects,
    reminders,
    projectReminderSync,
    reminderJob,
    revenueByService,
    metrics: {
      totalCustomers: customers.length,
      activeSubscriptions: activeSubscriptions.length,
      upcomingRenewals,
      pendingInvoices,
      monthlyRecurringRevenue,
      monthlySupplierCosts,
      monthlyExpenses,
      grossProfitMonthly,
      marginPercent,
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      projectDeadlinesSoon,
      projectOverdue,
    },
  });
}
