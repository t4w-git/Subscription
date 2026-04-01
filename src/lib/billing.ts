import { BillingCycle } from "@prisma/client";

export const cycleToMonths: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export function addCycle(baseDate: Date, cycle: BillingCycle): Date {
  const date = new Date(baseDate);
  date.setMonth(date.getMonth() + cycleToMonths[cycle]);
  return date;
}

export function cycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case "MONTHLY":
      return "Mensile";
    case "QUARTERLY":
      return "Trimestrale";
    case "SEMIANNUAL":
      return "Semestrale";
    case "ANNUAL":
      return "Annuale";
    default:
      return cycle;
  }
}

export function monthlyValue(value: number, cycle: BillingCycle): number {
  const months = cycleToMonths[cycle];
  return value / months;
}

export function convertBillingAmount(
  amount: number,
  fromCycle: BillingCycle,
  toCycle: BillingCycle,
): number {
  const monthly = monthlyValue(amount, fromCycle);
  return Math.round(monthly * cycleToMonths[toCycle] * 100) / 100;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeSubscriptionInvoiceAmount({
  basePrice,
  subscriptionStartDate,
  invoiceDueDate,
  promotionDiscountPercent,
  promotionDurationMonths,
}: {
  basePrice: number;
  subscriptionStartDate: Date;
  invoiceDueDate: Date;
  promotionDiscountPercent: number | null;
  promotionDurationMonths: number | null;
}): number {
  if (!promotionDiscountPercent || !promotionDurationMonths) {
    return roundCurrency(basePrice);
  }

  const promotionEndDate = addCycle(subscriptionStartDate, "MONTHLY");
  promotionEndDate.setMonth(
    promotionEndDate.getMonth() + Math.max(0, promotionDurationMonths - 1),
  );

  if (invoiceDueDate > promotionEndDate) {
    return roundCurrency(basePrice);
  }

  const discounted = basePrice * (1 - promotionDiscountPercent / 100);
  return roundCurrency(discounted);
}
