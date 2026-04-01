import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const customerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.union([z.string().trim().email(), z.literal(""), z.undefined()]),
  phone: z.string().optional(),
  company: z.string().optional(),
});

export async function GET() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parseResult = customerSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json({ error: "Dati cliente non validi" }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name: parseResult.data.name,
        email: parseResult.data.email || null,
        phone: parseResult.data.phone || null,
        company: parseResult.data.company || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch {
    if (!parseResult.data.email) {
      try {
        const fallbackCustomer = await prisma.customer.create({
          data: {
            name: parseResult.data.name,
            email: `cliente-${Date.now()}-${Math.floor(Math.random() * 10000)}@placeholder.local`,
            phone: parseResult.data.phone || null,
            company: parseResult.data.company || null,
          },
        });

        return NextResponse.json(fallbackCustomer, { status: 201 });
      } catch {
        return NextResponse.json(
          { error: "Impossibile creare il cliente" },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: "Impossibile creare il cliente" },
      { status: 409 },
    );
  }
}
