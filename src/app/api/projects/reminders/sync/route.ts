import { NextResponse } from "next/server";
import { z } from "zod";
import { syncProjectDeadlineReminders } from "@/lib/project-reminders";

const syncSchema = z.object({
  daysBeforeDeadline: z.number().int().min(0).max(30).optional(),
});

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as unknown;
  const parsed = syncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Parametri non validi" }, { status: 400 });
  }

  const result = await syncProjectDeadlineReminders({
    daysBeforeDeadline: parsed.data.daysBeforeDeadline,
  });

  return NextResponse.json({
    message: "Reminder progetto sincronizzati",
    ...result,
  });
}
