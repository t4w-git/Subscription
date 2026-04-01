import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  computeSubscriptionInvoiceAmount,
  convertBillingAmount,
} from "@/lib/billing";
import { buildAdminRetroactiveTemplate } from "@/lib/admin-retroactive-template";

type Params = {
  params: Promise<{ id: string }>;
};

const retroactiveSchema = z.object({
  referenceYear: z.coerce.number().int().min(1900).max(2100),
});

function resolveAdminRecipient(persistedFromEmail?: string, persistedUser?: string) {
  return (
    process.env.ADMIN_EMAIL ||
    persistedFromEmail ||
    process.env.SMTP_FROM ||
    persistedUser ||
    process.env.SMTP_USER ||
    null
  );
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = retroactiveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Anno di riferimento non valido" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      customer: true,
      plan: true,
    },
  });

  if (!subscription) {
    return NextResponse.json({ error: "Abbonamento non trovato" }, { status: 404 });
  }

  const smtpConfig = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
  const adminRecipient = resolveAdminRecipient(smtpConfig?.fromEmail, smtpConfig?.user);

  if (!adminRecipient) {
    return NextResponse.json(
      { error: "Destinatario amministrazione non configurato (ADMIN_EMAIL o SMTP)" },
      { status: 400 },
    );
  }

  const effectiveCycle = subscription.billingCycle || subscription.plan.billingCycle;
  const referenceInvoiceDate = new Date(subscription.startDate);
  referenceInvoiceDate.setFullYear(parsed.data.referenceYear);

  const convertedBasePrice = convertBillingAmount(
    Number(subscription.plan.price),
    subscription.plan.billingCycle,
    effectiveCycle,
  );

  const taxableAmount = computeSubscriptionInvoiceAmount({
    basePrice: convertedBasePrice * subscription.quantity,
    subscriptionStartDate: subscription.startDate,
    invoiceDueDate: referenceInvoiceDate,
    promotionDiscountPercent: subscription.plan.promotionDiscountPercent,
    promotionDurationMonths: subscription.plan.promotionDurationMonths,
  });

  const template = buildAdminRetroactiveTemplate({
    customerName: subscription.customer.name,
    customerEmail: subscription.customer.email,
    serviceName: subscription.plan.name,
    billingCycle: effectiveCycle,
    quantity: subscription.quantity,
    taxableAmount,
    referenceYear: parsed.data.referenceYear,
    startDate: subscription.startDate,
    notes: subscription.notes,
  });

  try {
    await sendEmail({
      to: adminRecipient,
      subject: template.subject,
      text: template.text,
    });

    return NextResponse.json({
      success: true,
      message: "Invio abbonamento retroattivo inviato all'amministrazione",
      to: adminRecipient,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invio abbonamento retroattivo fallito",
        detail: error instanceof Error ? error.message : "Errore sconosciuto",
      },
      { status: 500 },
    );
  }
}
