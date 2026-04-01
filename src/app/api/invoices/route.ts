import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeInvoice, serializePlan } from "@/lib/serializers";
import { buildBillingReminderTemplate } from "@/lib/reminder-template";
import { processDueReminders } from "@/lib/reminders";

const invoiceSchema = z.object({
  subscriptionId: z.string().min(1),
  amount: z.coerce.number().positive(),
  dueDate: z.coerce.date(),
  invoiceNumber: z.string().min(3).optional(),
});

function isRealEmail(email: string | null): email is string {
  return Boolean(email && !email.endsWith("@placeholder.local"));
}

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    include: {
      subscription: {
        include: {
          customer: true,
          plan: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(
    invoices.map((invoice) => ({
      ...serializeInvoice(invoice),
      subscription: {
        ...invoice.subscription,
        plan: serializePlan(invoice.subscription.plan),
      },
    })),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const parseResult = invoiceSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: "Dati fattura non validi" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: parseResult.data.subscriptionId },
    include: {
      customer: true,
      plan: true,
    },
  });

  if (!subscription) {
    return NextResponse.json({ error: "Abbonamento non trovato" }, { status: 404 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId: parseResult.data.subscriptionId,
      amount: parseResult.data.amount,
      dueDate: parseResult.data.dueDate,
      invoiceNumber:
        parseResult.data.invoiceNumber ||
        `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    },
  });

  if (isRealEmail(subscription.customer.email)) {
    const template = buildBillingReminderTemplate({
      customerName: subscription.customer.name,
      serviceName: subscription.plan.name,
      quantity: subscription.quantity,
      invoiceAmount: Number(invoice.amount),
      invoiceDueDate: invoice.dueDate,
      invoiceNumber: invoice.invoiceNumber,
      notes: subscription.notes,
    });

    await prisma.reminder.create({
      data: {
        customerId: subscription.customerId,
        subscriptionId: subscription.id,
        email: subscription.customer.email,
        subject: template.subject,
        message: template.message,
        remindAt: new Date(),
      },
    });

    await processDueReminders();
  }

  return NextResponse.json(serializeInvoice(invoice), { status: 201 });
}
