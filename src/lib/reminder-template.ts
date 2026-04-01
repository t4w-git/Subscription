type BillingReminderTemplateInput = {
  customerName?: string | null;
  serviceName?: string | null;
  quantity?: number | null;
  invoiceAmount?: number | null;
  invoiceDueDate?: Date | null;
  invoiceNumber?: string | null;
  notes?: string | null;
};

const eurFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return value.toLocaleDateString("it-IT");
}

function formatAmount(value?: number | null) {
  if (value === undefined || value === null) {
    return "-";
  }

  return eurFormatter.format(value);
}

export function buildBillingReminderTemplate(input: BillingReminderTemplateInput) {
  const customerName = input.customerName?.trim() || "Cliente";
  const serviceName = input.serviceName?.trim() || "servizio";
  const quantity = input.quantity && input.quantity > 0 ? input.quantity : 1;
  const dueDate = formatDate(input.invoiceDueDate);
  const invoiceAmount = formatAmount(input.invoiceAmount);
  const invoiceNumber = input.invoiceNumber?.trim() || "-";

  const subject = `Promemoria fatturazione - ${serviceName}`;
  const notes = input.notes?.trim() || null;

  const message = [
    `Gentile ${customerName},`,
    "",
    "ti ricordiamo la prossima scadenza di fatturazione del tuo servizio:",
    `- Servizio: ${serviceName}`,
    `- Quantità: ${quantity}`,
    `- Numero fattura: ${invoiceNumber}`,
    `- Importo: ${invoiceAmount}`,
    `- Scadenza: ${dueDate}`,
    ...(notes ? [`- Note: ${notes}`] : []),
    "",
    "Se hai già effettuato il pagamento, ignora questo messaggio.",
    "Per qualsiasi chiarimento, rispondi a questa email.",
    "",
    "Cordiali saluti",
  ].join("\n");

  return {
    subject,
    message,
  };
}

type ProjectReminderTemplateInput = {
  customerName?: string | null;
  projectName?: string | null;
  deadline?: Date | null;
  progress?: number | null;
  milestoneSummary?: string[];
};

export function buildProjectDeadlineReminderTemplate(input: ProjectReminderTemplateInput) {
  const customerName = input.customerName?.trim() || "Cliente";
  const projectName = input.projectName?.trim() || "Progetto";
  const deadline = formatDate(input.deadline);
  const progress =
    typeof input.progress === "number" && Number.isFinite(input.progress)
      ? `${Math.max(0, Math.min(100, Math.round(input.progress)))}%`
      : "-";

  const subject = `Promemoria progetto - ${projectName}`;
  const milestoneLines = (input.milestoneSummary || []).slice(0, 5);

  const message = [
    `Gentile ${customerName},`,
    "",
    "ti ricordiamo la prossima scadenza progetto:",
    `- Progetto: ${projectName}`,
    `- Deadline: ${deadline}`,
    `- Stato avanzamento: ${progress}`,
    ...(milestoneLines.length > 0
      ? ["- Milestone rilevanti:", ...milestoneLines.map((line) => `  - ${line}`)]
      : []),
    "",
    "Rimaniamo a disposizione per eventuali aggiornamenti o priorita.",
    "",
    "Cordiali saluti",
  ].join("\n");

  return {
    subject,
    message,
  };
}
