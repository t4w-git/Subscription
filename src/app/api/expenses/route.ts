import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const expenseFrequencySchema = z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL"]);

const expenseSchema = z.object({
  supplierId: z.union([z.string().trim().min(1), z.literal(""), z.undefined()]),
  serviceName: z.string().trim().min(2),
  amount: z.preprocess(
    (value) => {
      if (typeof value === "string") {
        const normalized = value.replace(",", ".").trim();
        return normalized === "" ? Number.NaN : Number(normalized);
      }

      return value;
    },
    z.number().positive(),
  ),
  frequency: expenseFrequencySchema.default("MONTHLY"),
  expenseDate: z.preprocess((value) => (value === "" ? undefined : value), z.coerce.date().optional()),
  notes: z.string().optional(),
});

export async function GET() {
  const expenses = await prisma.expense.findMany({
    include: {
      supplier: true,
    },
    orderBy: { expenseDate: "desc" },
  });

  return NextResponse.json(
    expenses.map((expense) => ({
      ...expense,
      amount: Number(expense.amount),
    })),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = expenseSchema.safeParse(body);

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
    const expense = await prisma.expense.create({
      data: {
        supplierId: parsed.data.supplierId || null,
        serviceName: parsed.data.serviceName,
        amount: parsed.data.amount,
        frequency: parsed.data.frequency,
        expenseDate: parsed.data.expenseDate || new Date(),
        notes: parsed.data.notes || null,
      },
      include: {
        supplier: true,
      },
    });

    return NextResponse.json(
      {
        ...expense,
        amount: Number(expense.amount),
      },
      { status: 201 },
    );
  } catch (error) {
    let detail = "Errore interno";

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      detail = `${error.code} - ${error.message}`;
    } else if (error instanceof Error) {
      detail = error.message;
    }

    return NextResponse.json({ error: "Errore inserimento costo", detail }, { status: 500 });
  }
}
