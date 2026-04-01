import { NextResponse } from "next/server";
import { z } from "zod";
import { BillingCycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializePlan } from "@/lib/serializers";

type Params = {
  params: Promise<{ id: string }>;
};

const updatePlanSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  billingCycle: z.enum(BillingCycle),
  supplierId: z.string().nullable().optional(),
  providerCost: z.coerce.number().nonnegative().nullable().optional(),
  promotionDiscountPercent: z.coerce.number().int().min(1).max(100).nullable().optional(),
  promotionDurationMonths: z.coerce.number().int().min(1).max(120).nullable().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updatePlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati servizio non validi" }, { status: 400 });
  }

  try {
    const updated = await prisma.plan.update({
      where: { id },
      data: {
        name: parsed.data.name,
        price: parsed.data.price,
        currency: parsed.data.currency.toUpperCase(),
        billingCycle: parsed.data.billingCycle,
        supplierId: parsed.data.supplierId || null,
        providerCost: parsed.data.providerCost ?? null,
        promotionDiscountPercent: parsed.data.promotionDiscountPercent ?? null,
        promotionDurationMonths: parsed.data.promotionDurationMonths ?? null,
      },
      include: {
        supplier: true,
      },
    });

    return NextResponse.json(serializePlan(updated));
  } catch {
    return NextResponse.json({ error: "Impossibile aggiornare servizio" }, { status: 409 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.plan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Servizio non trovato o non eliminabile" }, { status: 409 });
  }
}