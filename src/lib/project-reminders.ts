import { ReminderStatus } from "@prisma/client";
import { addDays, isAfter, isBefore, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { buildProjectDeadlineReminderTemplate } from "@/lib/reminder-template";

type SyncProjectDeadlineRemindersOptions = {
  daysBeforeDeadline?: number;
};

function normalizeReminderDate(deadline: Date, daysBeforeDeadline: number) {
  const base = startOfDay(deadline);
  const reminderDate = addDays(base, -daysBeforeDeadline);
  const now = new Date();

  if (isBefore(reminderDate, now)) {
    return now;
  }

  return reminderDate;
}

export async function syncProjectDeadlineReminders(
  options: SyncProjectDeadlineRemindersOptions = {},
) {
  const daysBeforeDeadline = Number.isFinite(options.daysBeforeDeadline)
    ? Math.max(0, Math.min(30, Math.floor(options.daysBeforeDeadline!)))
    : 3;

  const now = new Date();
  const horizon = addDays(now, 60);

  const projects = await prisma.project.findMany({
    where: {
      deadline: {
        not: null,
      },
      status: {
        in: ["PLANNING", "IN_PROGRESS", "ON_HOLD"],
      },
      customer: {
        email: {
          not: null,
        },
      },
    },
    include: {
      customer: true,
      milestones: {
        where: {
          deadline: {
            not: null,
          },
        },
        orderBy: {
          deadline: "asc",
        },
      },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const project of projects) {
    if (!project.deadline || !project.customer?.email) {
      skipped += 1;
      continue;
    }

    if (isAfter(project.deadline, horizon)) {
      skipped += 1;
      continue;
    }

    const remindAt = normalizeReminderDate(project.deadline, daysBeforeDeadline);
    const remindAtDayStart = startOfDay(remindAt);
    const remindAtDayEnd = addDays(remindAtDayStart, 1);

    const existing = await prisma.reminder.findFirst({
      where: {
        projectId: project.id,
        status: {
          in: [ReminderStatus.PENDING, ReminderStatus.SENT],
        },
        remindAt: {
          gte: remindAtDayStart,
          lt: remindAtDayEnd,
        },
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const milestoneSummary = project.milestones
      .slice(0, 3)
      .map((milestone) => `${milestone.title} (${milestone.deadline?.toLocaleDateString("it-IT")})`);

    const template = buildProjectDeadlineReminderTemplate({
      customerName: project.customer.name,
      projectName: project.name,
      deadline: project.deadline,
      progress: project.progress,
      milestoneSummary,
    });

    await prisma.reminder.create({
      data: {
        customerId: project.customerId,
        projectId: project.id,
        email: project.customer.email,
        subject: template.subject,
        message: template.message,
        remindAt,
        status: ReminderStatus.PENDING,
      },
    });

    created += 1;
  }

  return {
    scanned: projects.length,
    created,
    skipped,
    daysBeforeDeadline,
  };
}
