import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { convertBillingAmount } from "@/lib/billing";
import { buildAdminBillingCountTemplate } from "@/lib/admin-billing-count-template";

type Params = {
  params: Promise<{ id: string }>;
};

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

export async function POST(_: Request, { params }: Params) {
  const { id } = await params;

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

  const smtpConfig = await prisma.smtpConfig.findUnique({
    where: { id: "default" },
  });

  const adminRecipient = resolveAdminRecipient(smtpConfig?.fromEmail, smtpConfig?.user);

  if (!adminRecipient) {
    return NextResponse.json(
      { error: "Destinatario amministrazione non configurato (ADMIN_EMAIL o SMTP)" },
      { status: 400 },
    );
  }

  const effectiveCycle = subscription.billingCycle || subscription.plan.billingCycle;
  const singleAmount = convertBillingAmount(
    Number(subscription.plan.price),
    subscription.plan.billingCycle,
    effectiveCycle,
  );
  const totalAmount = singleAmount * subscription.quantity;

  const template = buildAdminBillingCountTemplate({
    customerName: subscription.customer.name,
    customerEmail: subscription.customer.email,
    serviceName: subscription.plan.name,
    billingCycle: effectiveCycle,
    quantity: subscription.quantity,
    singleAmount,
    totalAmount,
    nextBillingDate: subscription.nextBillingDate,
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
      message: "Conteggio inviato all'amministrazione",
      to: adminRecipient,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invio conteggio fallito",
        detail: error instanceof Error ? error.message : "Errore sconosciuto",
      },
      { status: 500 },
    );
  }
}
