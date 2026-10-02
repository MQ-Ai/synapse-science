import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email, name, level,
      questionId, year, topic,
      stars, timeSeconds, turns, completed,
    } = body;

    const sheetUrl = process.env.LEADS_SHEET_URL;
    if (sheetUrl) {
      await fetch(sheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "session",
          email, name, level,
          questionId, year, topic,
          stars, timeSeconds, turns,
          completed: completed ? "Yes" : "No",
        }),
        redirect: "follow",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("sessions route error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
