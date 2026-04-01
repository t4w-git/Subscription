import {
  InvoiceStatus,
  BillingCycle,
  SubscriptionStatus,
  DurationUnit,
} from "@prisma/client";

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
  price: unknown;
  currency: string;
  billingCycle: BillingCycle;
  supplierId: string | null;
  providerCost: unknown;
  promotionDiscountPercent: number | null;
  promotionDurationMonths: number | null;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  amount: unknown;
  dueDate: Date;
  issuedAt: Date;
  paidAt: Date | null;
  status: InvoiceStatus;
};

type Subscription = {
  id: string;
  customerId: string;
  planId: string;
  startDate: Date;
  billingCycle?: BillingCycle | null;
  quantity: number;
  durationValue: number | null;
  durationUnit: DurationUnit | null;
  nextBillingDate: Date;
  status: SubscriptionStatus;
  notes: string | null;
  customer: Customer;
  plan: Plan;
  invoices: Invoice[];
};

export function serializePlan(plan: Plan) {
  return {
    ...plan,
    price: Number(plan.price),
    providerCost: plan.providerCost !== null ? Number(plan.providerCost) : null,
  };
}

export function serializeInvoice(invoice: Invoice) {
  return {
    ...invoice,
    amount: Number(invoice.amount),
  };
}

export function serializeSubscription(subscription: Subscription) {
  return {
    ...subscription,
    billingCycle: subscription.billingCycle ?? null,
    plan: serializePlan(subscription.plan),
    invoices: subscription.invoices.map(serializeInvoice),
  };
}
