import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

const updateCustomerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]),
  phone: z.string().optional(),
  company: z.string().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Dati cliente non validi" }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        company: parsed.data.company || null,
      },
    });

    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Impossibile aggiornare cliente" }, { status: 409 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Cliente non trovato o non eliminabile" }, { status: 409 });
  }
}