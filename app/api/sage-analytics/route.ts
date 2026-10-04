import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { email, source } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const ts = new Date().toISOString();

    // Log to Vercel console (backup)
    console.log(JSON.stringify({
      event: "lead_captured",
      email: cleanEmail,
      source: source ?? "psle",
      ts,
    }));

    // Email notification via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Sage Leads <onboarding@resend.dev>",
            to: "alimaz@gmail.com",
            subject: `New Sage signup: ${cleanEmail}`,
            text: `New lead captured!\n\nEmail: ${cleanEmail}\nSource: ${source ?? "psle"}\nTime: ${ts}`,
          }),
        });
        const resendBody = await resendRes.json();
        console.log("Resend result:", JSON.stringify(resendBody));
      } catch (err) {
        console.error("Resend email failed:", err);
      }
    } else {
      console.error("RESEND_API_KEY not set");
    }

    // Append to Google Sheet via Apps Script Web App (POST)
    const sheetUrl = process.env.LEADS_SHEET_URL;
    console.log("LEADS_SHEET_URL present:", !!sheetUrl);
    if (sheetUrl) {
      try {
        const payload = JSON.stringify({ email: cleanEmail, source: source ?? "psle", ts });
        console.log("Posting to sheet:", sheetUrl, "payload:", payload);
        const res = await fetch(sheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          redirect: "follow",
        });
        const body = await res.text();
        console.log("Sheet status:", res.status, "body:", body);
      } catch (err) {
        console.error("Sheet write failed:", err);
      }
    } else {
      console.error("LEADS_SHEET_URL not set");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Lead API error:", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
