import { NextResponse } from "next/server";
import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeInvoice } from "@/lib/serializers";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_: Request, { params }: Params) {
  const { id } = await params;

  try {
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
      },
    });

    return NextResponse.json(serializeInvoice(invoice));
  } catch {
    return NextResponse.json({ error: "Fattura non trovata" }, { status: 404 });
  }
}
