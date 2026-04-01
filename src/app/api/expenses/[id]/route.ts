import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

const expenseFrequencySchema = z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL"]);

const updateExpenseSchema = z.object({
  supplierId: z.union([z.string().trim().min(1), z.literal(""), z.null()]).optional(),
  serviceName: z.string().trim().min(2).optional(),
  amount: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const normalized = value.replace(",", ".").trim();
        return normalized === "" ? undefined : Number(normalized);
      }

      return value;
    },
    z.number().positive().optional(),
  ),
  frequency: expenseFrequencySchema.optional(),
  expenseDate: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.date().optional()),
  notes: z.string().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateExpenseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dati costo non validi",
        detail: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  if (parsed.data.supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: parsed.data.supplierId },
      select: { id: true },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Fornitore non trovato" }, { status: 404 });
    }
  }

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(parsed.data.supplierId !== undefined
          ? { supplierId: parsed.data.supplierId || null }
          : {}),
        ...(parsed.data.serviceName !== undefined ? { serviceName: parsed.data.serviceName } : {}),
        ...(parsed.data.amount !== undefined ? { amount: parsed.data.amount } : {}),
        ...(parsed.data.frequency !== undefined ? { frequency: parsed.data.frequency } : {}),
        ...(parsed.data.expenseDate !== undefined ? { expenseDate: parsed.data.expenseDate } : {}),
        ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
      },
      include: { supplier: true },
    });

    return NextResponse.json({
      ...expense,
      amount: Number(expense.amount),
    });
  } catch {
    return NextResponse.json({ error: "Costo non trovato" }, { status: 404 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Costo non trovato" }, { status: 404 });
  }
}
