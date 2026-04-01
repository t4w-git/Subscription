import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

const updateSupplierSchema = z.object({
  name: z.string().min(2),
});

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSupplierSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati fornitore non validi" }, { status: 400 });
  }

  try {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: parsed.data.name,
      },
    });

    return NextResponse.json(supplier);
  } catch {
    return NextResponse.json({ error: "Impossibile aggiornare fornitore" }, { status: 409 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Fornitore non trovato o non eliminabile" }, { status: 409 });
  }
}