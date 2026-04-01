import { ReminderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasSmtpConfig, sendEmail } from "@/lib/email";

export async function processDueReminders() {
  if (!(await hasSmtpConfig())) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "SMTP non configurato",
    };
  }

  const due = await prisma.reminder.findMany({
    where: {
      status: ReminderStatus.PENDING,
      remindAt: {
        lte: new Date(),
      },
    },
    orderBy: {
      remindAt: "asc",
    },
  });

  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    try {
      await sendEmail({
        to: reminder.email,
        subject: reminder.subject,
        text: reminder.message,
      });

      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.SENT,
          sentAt: new Date(),
          lastError: null,
        },
      });

      sent += 1;
    } catch (error) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: {
          status: ReminderStatus.FAILED,
          lastError: error instanceof Error ? error.message : "Errore invio email",
        },
      });

      failed += 1;
    }
  }

  return {
    processed: due.length,
    sent,
    failed,
    skipped: false,
  };
}
