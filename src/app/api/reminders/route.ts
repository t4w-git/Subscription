import { NextResponse } from "next/server";
import { z } from "zod";
import { ReminderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildBillingReminderTemplate } from "@/lib/reminder-template";

const reminderSchema = z.object({
  customerId: z.string().optional(),
  subscriptionId: z.string().optional(),
  email: z.email().optional(),
  subject: z.string().trim().min(3).optional(),
  message: z.string().trim().min(5).optional(),
  remindAt: z.coerce.date(),
});

export async function GET() {
  const reminders = await prisma.reminder.findMany({
    include: {
      customer: true,
      subscription: {
        include: {
          plan: true,
        },
      },
      project: true,
    },
    orderBy: {
      remindAt: "asc",
    },
  });

  return NextResponse.json(reminders);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = reminderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati reminder non validi" }, { status: 400 });
  }

  const customer = parsed.data.customerId
    ? await prisma.customer.findUnique({ where: { id: parsed.data.customerId } })
    : null;

  const subscription = parsed.data.subscriptionId
    ? await prisma.subscription.findUnique({
        where: { id: parsed.data.subscriptionId },
        include: {
          customer: true,
          plan: true,
        },
      })
    : null;

  const nextInvoice = subscription
    ? await prisma.invoice.findFirst({
        where: {
          subscriptionId: subscription.id,
          status: {
            in: ["PENDING", "OVERDUE"],
          },
        },
        orderBy: {
          dueDate: "asc",
        },
      })
    : null;

  const template = buildBillingReminderTemplate({
    customerName: subscription?.customer.name || customer?.name,
    serviceName: subscription?.plan.name,
    quantity: subscription?.quantity,
    invoiceAmount: nextInvoice ? Number(nextInvoice.amount) : null,
    invoiceDueDate: nextInvoice?.dueDate,
    invoiceNumber: nextInvoice?.invoiceNumber,
    notes: subscription?.notes,
  });

  const resolvedEmail =
    parsed.data.email || subscription?.customer.email || customer?.email || null;

  const resolvedSubject = parsed.data.subject?.trim() || template.subject;
  const resolvedMessage = parsed.data.message?.trim() || template.message;

  if (!resolvedEmail) {
    return NextResponse.json(
      { error: "Email destinatario mancante: seleziona cliente/abbonamento o inseriscila manualmente" },
      { status: 400 },
    );
  }

  const reminder = await prisma.reminder.create({
    data: {
      customerId: parsed.data.customerId || null,
      subscriptionId: parsed.data.subscriptionId || null,
      email: resolvedEmail,
      subject: resolvedSubject,
      message: resolvedMessage,
      remindAt: parsed.data.remindAt,
      status: ReminderStatus.PENDING,
    },
  });

  return NextResponse.json(reminder, { status: 201 });
}
