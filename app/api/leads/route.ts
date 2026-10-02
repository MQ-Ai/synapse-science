import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, source, name, level } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const ts = new Date().toISOString();

    console.log(JSON.stringify({ event: "lead_captured", email: cleanEmail, name, level, source: source ?? "psle", ts }));

    // 1. Send notification email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Sage Leads <onboarding@resend.dev>",
            to: ["alimaz@gmail.com"],
            subject: `New Sage signup: ${name || cleanEmail} (${level || "?"})`,
            text: `New lead!\n\nName: ${name || "-"}\nLevel: ${level || "-"}\nEmail: ${cleanEmail}\nSource: ${source ?? "psle"}\nTime: ${ts}`,
          }),
        });
        const result = await response.json();
        console.log("Resend result:", JSON.stringify(result));
      } catch (err) {
        console.error("Resend failed:", err);
      }
    } else {
      console.error("RESEND_API_KEY is not set");
    }

    // 2. Append to Google Sheet via Apps Script (POST with JSON body)
    const sheetUrl = process.env.LEADS_SHEET_URL;
    if (sheetUrl) {
      try {
        const res = await fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "lead",
            email: cleanEmail,
            name: name || "",
            level: level || "",
            source: source ?? "psle",
            ts,
          }),
          redirect: "follow",
        });
        console.log("Sheet status:", res.status);
      } catch (err) {
        console.error("Sheet write failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Lead API error:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
