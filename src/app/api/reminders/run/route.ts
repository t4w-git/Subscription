import { NextResponse } from "next/server";
import { processDueReminders } from "@/lib/reminders";

export async function POST() {
  const result = await processDueReminders();

  return NextResponse.json({
    message: result.skipped
      ? "Nessun invio: SMTP non configurato"
      : "Reminder elaborati",
    ...result,
  });
}
