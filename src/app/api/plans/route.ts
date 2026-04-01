import { NextResponse } from "next/server";
import { z } from "zod";
import { BillingCycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializePlan } from "@/lib/serializers";

const planSchema = z.object({
  name: z.string().min(2),
  price: z.coerce.number().positive(),
  currency: z.string().min(3).max(3).default("EUR"),
  billingCycle: z.enum(BillingCycle),
  supplierId: z.string().optional(),
  providerCost: z.coerce.number().nonnegative().optional(),
  promotionDiscountPercent: z.coerce.number().int().min(1).max(100).optional(),
  promotionDurationMonths: z.coerce.number().int().min(1).max(120).optional(),
});

export async function GET() {
  const plans = await prisma.plan.findMany({
    include: {
      supplier: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(plans.map(serializePlan));
}

export async function POST(request: Request) {
  const body = await request.json();
  const parseResult = planSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: "Dati piano non validi" }, { status: 400 });
  }

  const plan = await prisma.plan.create({
    data: {
      name: parseResult.data.name,
      price: parseResult.data.price,
      currency: parseResult.data.currency.toUpperCase(),
      billingCycle: parseResult.data.billingCycle,
      supplierId: parseResult.data.supplierId || null,
      providerCost: parseResult.data.providerCost ?? null,
      promotionDiscountPercent: parseResult.data.promotionDiscountPercent || null,
      promotionDurationMonths: parseResult.data.promotionDurationMonths || null,
    },
    include: {
      supplier: true,
    },
  });

  return NextResponse.json(serializePlan(plan), { status: 201 });
}
