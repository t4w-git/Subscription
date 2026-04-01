import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

function parsePort(value?: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 587;
  }
  return parsed;
}

type RuntimeSmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

async function getSmtpConfig(): Promise<RuntimeSmtpConfig | null> {
  const persisted = await prisma.smtpConfig.findUnique({
    where: { id: "default" },
  });

  if (persisted) {
    const from = persisted.fromName
      ? `${persisted.fromName} <${persisted.fromEmail}>`
      : persisted.fromEmail;

    return {
      host: persisted.host,
      port: persisted.port,
      user: persisted.user,
      pass: persisted.pass,
      from,
    };
  }

  if (
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  ) {
    return {
      host: process.env.SMTP_HOST,
      port: parsePort(process.env.SMTP_PORT),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.SMTP_FROM,
    };
  }

  return null;
}

export async function hasSmtpConfig(): Promise<boolean> {
  const config = await getSmtpConfig();
  return Boolean(config);
}

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}) {
  const smtpConfig = await getSmtpConfig();

  if (!smtpConfig) {
    throw new Error("Configurazione SMTP mancante");
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  await transporter.sendMail({
    from: smtpConfig.from,
    to,
    subject,
    text,
  });
}
