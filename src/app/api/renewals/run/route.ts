import { NextResponse } from "next/server";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  addCycle,
  computeSubscriptionInvoiceAmount,
  convertBillingAmount,
} from "@/lib/billing";
import { buildBillingReminderTemplate } from "@/lib/reminder-template";
import { processDueReminders } from "@/lib/reminders";

function isRealEmail(email: string | null): email is string {
  return Boolean(email && !email.endsWith("@placeholder.local"));
}

function generateInvoiceNumber(subscriptionId: string, dueDate: Date, attempt: number) {
  const compactDate = dueDate.toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${compactDate}-${subscriptionId.slice(0, 6)}-${attempt}`;
}

export async function POST() {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const dueSubscriptions = await tx.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: {
          lte: now,
        },
      },
      include: {
        customer: true,
        plan: true,
      },
      orderBy: {
        nextBillingDate: "asc",
      },
    });

    let generatedInvoices = 0;

    for (const subscription of dueSubscriptions) {
      const effectiveBillingCycle = subscription.billingCycle || subscription.plan.billingCycle;
      let dueDate = new Date(subscription.nextBillingDate);
      let attempt = 1;

      while (dueDate <= now) {
        const existingInvoice = await tx.invoice.findFirst({
          where: {
            subscriptionId: subscription.id,
            dueDate,
          },
          select: { id: true },
        });

        if (!existingInvoice) {
          const convertedBasePrice = convertBillingAmount(
            Number(subscription.plan.price),
            subscription.plan.billingCycle,
            effectiveBillingCycle,
          );

          const invoiceAmount = computeSubscriptionInvoiceAmount({
            basePrice: convertedBasePrice * subscription.quantity,
            subscriptionStartDate: subscription.startDate,
            invoiceDueDate: dueDate,
            promotionDiscountPercent: subscription.plan.promotionDiscountPercent,
            promotionDurationMonths: subscription.plan.promotionDurationMonths,
          });

          const invoice = await tx.invoice.create({
            data: {
              subscriptionId: subscription.id,
              amount: invoiceAmount,
              dueDate,
              invoiceNumber: generateInvoiceNumber(subscription.id, dueDate, attempt),
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

          generatedInvoices += 1;
        }

        dueDate = addCycle(dueDate, effectiveBillingCycle);
        attempt += 1;
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          nextBillingDate: dueDate,
        },
      });
    }

    return {
      processedSubscriptions: dueSubscriptions.length,
      generatedInvoices,
    };
  });

  const reminderResult = await processDueReminders();

  return NextResponse.json({
    message: "Rinnovi ricorrenti elaborati con successo",
    ...result,
    reminders: reminderResult,
  });
}
