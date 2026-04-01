import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const supplierSchema = z.object({
  name: z.string().min(2),
});

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
  });

  return NextResponse.json(suppliers);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = supplierSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati fornitore non validi" }, { status: 400 });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        name: parsed.data.name,
      },
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Fornitore già esistente" }, { status: 409 });
  }
}
