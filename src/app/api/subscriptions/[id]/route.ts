import { NextResponse } from "next/server";
import { BillingCycle, DurationUnit, SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeSubscription } from "@/lib/serializers";
import {
  addCycle,
  computeSubscriptionInvoiceAmount,
  convertBillingAmount,
} from "@/lib/billing";
import { buildBillingReminderTemplate } from "@/lib/reminder-template";
import { processDueReminders } from "@/lib/reminders";

type Params = {
  params: Promise<{ id: string }>;
};

const updateSubscriptionSchema = z.object({
  billingCycle: z.union([z.enum(BillingCycle), z.null()]).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  durationValue: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  durationUnit: z.union([z.nativeEnum(DurationUnit), z.null()]).optional(),
  status: z.nativeEnum(SubscriptionStatus).optional(),
  startDate: z.coerce.date().optional(),
  activationStartDate: z.coerce.date().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  const hasDurationValue = typeof data.durationValue === "number";
  const hasDurationUnit = typeof data.durationUnit === "string";

  if (hasDurationValue !== hasDurationUnit) {
    return false;
  }

  if (data.durationValue === null && data.durationUnit !== null && data.durationUnit !== undefined) {
    return false;
  }

  return true;
}, {
  message: "Durata e unità devono essere valorizzate insieme",
  path: ["durationUnit"],
});

function isRealEmail(email: string | null): email is string {
  return Boolean(email && !email.endsWith("@placeholder.local"));
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati aggiornamento non validi" }, { status: 400 });
  }

  try {
    const existing = await prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: true,
        plan: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Abbonamento non trovato" }, { status: 404 });
    }

    const nextStatus = parsed.data.status ?? existing.status;
    const nextBillingCycle = parsed.data.billingCycle ?? existing.billingCycle ?? existing.plan.billingCycle;
    const nextQuantity = parsed.data.quantity ?? existing.quantity;
    const isActivating = existing.status !== SubscriptionStatus.ACTIVE && nextStatus === SubscriptionStatus.ACTIVE;
    const requestedStartDate = parsed.data.startDate ?? parsed.data.activationStartDate;

    if (isActivating && !requestedStartDate) {
      return NextResponse.json(
        { error: "Per attivare l'abbonamento devi indicare la data della prima fattura" },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id },
        data: {
          ...(parsed.data.billingCycle !== undefined
            ? { billingCycle: parsed.data.billingCycle }
            : {}),
          ...(parsed.data.quantity !== undefined
            ? { quantity: parsed.data.quantity }
            : {}),
          ...(parsed.data.durationValue !== undefined
            ? { durationValue: parsed.data.durationValue }
            : {}),
          ...(parsed.data.durationUnit !== undefined
            ? { durationUnit: parsed.data.durationUnit }
            : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(requestedStartDate
            ? {
                startDate: requestedStartDate,
                nextBillingDate: addCycle(requestedStartDate, nextBillingCycle),
              }
            : {}),
        },
      });

      if (requestedStartDate && nextStatus === SubscriptionStatus.ACTIVE) {
        const existingInvoice = await tx.invoice.findFirst({
          where: {
            subscriptionId: id,
            dueDate: requestedStartDate,
          },
          select: { id: true },
        });

        if (!existingInvoice) {
          const convertedBasePrice = convertBillingAmount(
            Number(existing.plan.price),
            existing.plan.billingCycle,
            nextBillingCycle,
          );

          const invoiceAmount = computeSubscriptionInvoiceAmount({
            basePrice: convertedBasePrice * nextQuantity,
            subscriptionStartDate: requestedStartDate,
            invoiceDueDate: requestedStartDate,
            promotionDiscountPercent: existing.plan.promotionDiscountPercent,
            promotionDurationMonths: existing.plan.promotionDurationMonths,
          });

          const invoice = await tx.invoice.create({
            data: {
              subscriptionId: id,
              amount: invoiceAmount,
              dueDate: requestedStartDate,
              invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            },
          });

          if (isRealEmail(existing.customer.email)) {
            const template = buildBillingReminderTemplate({
              customerName: existing.customer.name,
              serviceName: existing.plan.name,
              quantity: nextQuantity,
              invoiceAmount,
              invoiceDueDate: invoice.dueDate,
              invoiceNumber: invoice.invoiceNumber,
              notes: existing.notes,
            });

            await tx.reminder.create({
              data: {
                customerId: existing.customerId,
                subscriptionId: existing.id,
                email: existing.customer.email,
                subject: template.subject,
                message: template.message,
                remindAt: new Date(),
              },
            });
          }
        }
      }

      return tx.subscription.findUniqueOrThrow({
        where: { id },
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

    return NextResponse.json(serializeSubscription(updated));
  } catch {
    return NextResponse.json({ error: "Abbonamento non trovato" }, { status: 404 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.subscription.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Abbonamento non trovato" }, { status: 404 });
  }
}