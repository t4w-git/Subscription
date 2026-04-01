import { BillingCycle } from "@prisma/client";
import { cycleLabel } from "@/lib/billing";

type BuildAdminBillingCountTemplateInput = {
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  billingCycle: BillingCycle;
  quantity: number;
  singleAmount: number;
  totalAmount: number;
  nextBillingDate: Date;
  notes: string | null;
};

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function buildAdminBillingCountTemplate(input: BuildAdminBillingCountTemplateInput) {
  const subject = `Crea fattura cliente - ${input.customerName} - ${input.serviceName}`;

  const lines = [
    "Richiesta creazione fattura cliente",
    "",
    `Cliente: ${input.customerName}`,
    `Email cliente: ${input.customerEmail || "-"}`,
    `Servizio: ${input.serviceName}`,
    `Ciclicità: ${cycleLabel(input.billingCycle)}`,
    `Quantità: ${input.quantity}`,
    `Cifra singola: ${currencyFormatter.format(input.singleAmount)}`,
    `Totale: ${currencyFormatter.format(input.totalAmount)}`,
    `Prossima scadenza: ${input.nextBillingDate.toLocaleDateString("it-IT")}`,
    `Note abbonamento: ${input.notes || "-"}`,
    "",
    "Azione richiesta: emettere fattura cliente.",
  ];

  return {
    subject,
    text: lines.join("\n"),
  };
}
