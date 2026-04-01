import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const smtpConfigSchema = z.object({
  host: z.string().trim().min(1),
  port: z.coerce.number().int().positive(),
  user: z.string().trim().min(1),
  pass: z.string().min(1),
  fromEmail: z.string().trim().email(),
  fromName: z.string().trim().optional(),
});

const smtpTestSchema = z.object({
  to: z.string().trim().email(),
});

export async function GET() {
  const config = await prisma.smtpConfig.findUnique({
    where: { id: "default" },
  });

  if (!config) {
    return NextResponse.json({
      host: "",
      port: 587,
      user: "",
      pass: "",
      fromEmail: "",
      fromName: "",
      configured: false,
    });
  }

  return NextResponse.json({
    host: config.host,
    port: config.port,
    user: config.user,
    pass: config.pass,
    fromEmail: config.fromEmail,
    fromName: config.fromName || "",
    configured: true,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = smtpConfigSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dati SMTP non validi",
        detail: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  const updated = await prisma.smtpConfig.upsert({
    where: { id: "default" },
    update: {
      host: parsed.data.host,
      port: parsed.data.port,
      user: parsed.data.user,
      pass: parsed.data.pass,
      fromEmail: parsed.data.fromEmail,
      fromName: parsed.data.fromName || null,
    },
    create: {
      id: "default",
      host: parsed.data.host,
      port: parsed.data.port,
      user: parsed.data.user,
      pass: parsed.data.pass,
      fromEmail: parsed.data.fromEmail,
      fromName: parsed.data.fromName || null,
    },
  });

  return NextResponse.json({
    id: updated.id,
    host: updated.host,
    port: updated.port,
    user: updated.user,
    fromEmail: updated.fromEmail,
    fromName: updated.fromName,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = smtpTestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Email destinatario non valida",
        detail: parsed.error.issues[0]?.message,
      },
      { status: 400 },
    );
  }

  try {
    await sendEmail({
      to: parsed.data.to,
      subject: "Test configurazione SMTP",
      text: "Invio di test completato con successo.",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Errore invio test SMTP";
    return NextResponse.json({ error: "Invio test fallito", detail }, { status: 500 });
  }
}
