import { NextResponse } from "next/server";
import { z } from "zod";
import { BillingCycle, DurationUnit, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addCycle,
  computeSubscriptionInvoiceAmount,
  convertBillingAmount,
} from "@/lib/billing";
import { serializeSubscription } from "@/lib/serializers";
import { buildBillingReminderTemplate } from "@/lib/reminder-template";
import { processDueReminders } from "@/lib/reminders";

function isRealEmail(email: string | null): email is string {
  return Boolean(email && !email.endsWith("@placeholder.local"));
}

const subscriptionSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  startDate: z.coerce.date(),
  billingCycle: z.enum(BillingCycle).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  durationValue: z.coerce.number().int().positive().optional(),
  durationUnit: z.nativeEnum(DurationUnit).optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.durationValue && !data.durationUnit) {
    return false;
  }

  return true;
}, {
  message: "Specificare l'unità quando è presente la durata",
  path: ["durationUnit"],
});

export async function GET() {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        customer: true,
        plan: true,
        invoices: {
          orderBy: { dueDate: "asc" },
        },
      },
      orderBy: { nextBillingDate: "asc" },
    });

    return NextResponse.json(subscriptions.map(serializeSubscription));
  } catch {
    return NextResponse.json({ error: "Impossibile caricare gli abbonamenti" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const parseResult = subscriptionSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: "Dati abbonamento non validi" }, { status: 400 });
  }

  const plan = await prisma.plan.findUnique({ where: { id: parseResult.data.planId } });

  if (!plan) {
    return NextResponse.json({ error: "Piano non trovato" }, { status: 404 });
  }

  const effectiveBillingCycle = parseResult.data.billingCycle || plan.billingCycle;
  const nextBillingDate = addCycle(parseResult.data.startDate, effectiveBillingCycle);

  const created = await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        customerId: parseResult.data.customerId,
        planId: parseResult.data.planId,
        startDate: parseResult.data.startDate,
        billingCycle: effectiveBillingCycle,
        quantity: parseResult.data.quantity ?? 1,
        durationValue: parseResult.data.durationValue,
        durationUnit: parseResult.data.durationValue ? parseResult.data.durationUnit : null,
        nextBillingDate,
        notes: parseResult.data.notes || null,
        status: SubscriptionStatus.ACTIVE,
      },
      include: {
        customer: true,
        plan: true,
        invoices: true,
      },
    });

    const convertedBasePrice = convertBillingAmount(
      Number(subscription.plan.price),
      subscription.plan.billingCycle,
      effectiveBillingCycle,
    );

    const invoiceAmount = computeSubscriptionInvoiceAmount({
      basePrice: convertedBasePrice * subscription.quantity,
      subscriptionStartDate: subscription.startDate,
      invoiceDueDate: subscription.startDate,
      promotionDiscountPercent: subscription.plan.promotionDiscountPercent,
      promotionDurationMonths: subscription.plan.promotionDurationMonths,
    });

    const invoice = await tx.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount: invoiceAmount,
        dueDate: subscription.startDate,
        invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      },
    });

    if (isRealEmail(subscription.customer.email)) {
      const template = buildBillingReminderTemplate({
        customerName: subscription.customer.name,
        serviceName: subscription.plan.name,
        quantity: subscription.quantity,
        invoiceAmount,
        invoiceDueDate: invoice.dueDate,
        invoiceNumber: invoice.invoiceNumber,
        notes: subscription.notes,
      });

      await tx.reminder.create({
        data: {
          customerId: subscription.customerId,
          subscriptionId: subscription.id,
          email: subscription.customer.email,
          subject: template.subject,
          message: template.message,
                remindAt: new Date(),
        },
      });
    }

    return tx.subscription.findUniqueOrThrow({
      where: { id: subscription.id },
      include: {
        customer: true,
        plan: true,
        invoices: {
          orderBy: { dueDate: "asc" },
        },
      },
    });
  });

  await processDueReminders();

  return NextResponse.json(serializeSubscription(created), { status: 201 });
}
