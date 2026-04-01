import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function escapeCsv(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET() {
  const subscriptions = await prisma.subscription.findMany({
    include: {
      customer: true,
      plan: true,
    },
    orderBy: [
      {
        customer: {
          name: "asc",
        },
      },
      {
        createdAt: "asc",
      },
    ],
  });

  const header = [
    "Cliente",
    "Email Cliente",
    "Telefono Cliente",
    "Servizio",
    "Stato",
    "Ciclicità",
    "Quantità",
    "Data Inizio",
    "Prossima Fattura",
    "Note",
  ].join(",");

  const rows = subscriptions.map((subscription) => {
    return [
      escapeCsv(subscription.customer.name),
      escapeCsv(subscription.customer.email),
      escapeCsv(subscription.customer.phone),
      escapeCsv(subscription.plan.name),
      escapeCsv(subscription.status),
      escapeCsv(subscription.billingCycle || subscription.plan.billingCycle),
      escapeCsv(subscription.quantity),
      escapeCsv(subscription.startDate.toLocaleDateString("it-IT")),
      escapeCsv(subscription.nextBillingDate.toLocaleDateString("it-IT")),
      escapeCsv(subscription.notes),
    ].join(",");
  });

  const csvContent = [header, ...rows].join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abbonamenti-clienti-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
