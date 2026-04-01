import { BillingCycle } from "@prisma/client";
import { cycleLabel } from "@/lib/billing";

type BuildAdminRetroactiveTemplateInput = {
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  billingCycle: BillingCycle;
  quantity: number;
  taxableAmount: number;
  referenceYear: number;
  startDate: Date;
  notes: string | null;
};

const eurFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function buildAdminRetroactiveTemplate(input: BuildAdminRetroactiveTemplateInput) {
  const subject = `Invio abbonamento retroattivo - ${input.customerName} - ${input.serviceName}`;
  const taxableAmount = eurFormatter.format(input.taxableAmount);

  const text = [
    "Invio abbonamento retroattivo",
    "",
    `Anno di riferimento: ${input.referenceYear}`,
    `Cliente: ${input.customerName}`,
    `Email cliente: ${input.customerEmail || "-"}`,
    `Servizio: ${input.serviceName}`,
    `Ciclicità: ${cycleLabel(input.billingCycle)}`,
    `Quantità: ${input.quantity}`,
    `Imponibile da fatturare: ${taxableAmount}`,
    `Data partenza abbonamento: ${input.startDate.toLocaleDateString("it-IT")}`,
    `Note: ${input.notes || "-"}`,
    "",
    "Azione richiesta: verificare e procedere con fatturazione retroattiva.",
  ].join("\n");

  return {
    subject,
    text,
  };
}
