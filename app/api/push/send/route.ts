import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createHash, timingSafeEqual } from "node:crypto";
import { deleteSubscriptionByEndpoint, findSubscriptions, normalizeEmail } from "@/lib/push-store";

export const runtime = "nodejs";

const CHUNK_SIZE = 50;

interface SendBody {
  target?: { email?: unknown } | "broadcast";
  payload?: { title?: unknown; body?: unknown; url?: unknown; tag?: unknown };
}

// Constant-time comparison of the admin key so timing cannot reveal it.
function isAdmin(provided: string | null): boolean {
  const expected = process.env.ADMIN_API_KEY?.trim();
  if (!expected || !provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function safeUrl(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  // Only same-site paths or https links; anything else falls back to home.
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw.slice(0, 500);
  if (raw.startsWith("https://")) return raw.slice(0, 500);
  return "/";
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req.headers.get("x-admin-key"))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "VAPID keys are not configured." }, { status: 500 });
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  let body: SendBody;
  try {
    body = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = typeof body.payload?.title === "string" ? body.payload.title.trim() : "";
  const text = typeof body.payload?.body === "string" ? body.payload.body.trim() : "";
  if (!title || title.length > 100 || text.length > 300) {
    return NextResponse.json({ error: "payload.title (max 100) and payload.body (max 300) are required." }, { status: 400 });
  }

  let target: Parameters<typeof findSubscriptions>[0];
  if (body.target === "broadcast") {
    target = { broadcast: true };
  } else if (body.target && typeof body.target === "object" && typeof body.target.email === "string") {
    target = { email: normalizeEmail(body.target.email) };
  } else {
    return NextResponse.json({ error: "target must be \"broadcast\" or { email }." }, { status: 400 });
  }

  const message = JSON.stringify({
    title,
    body: text,
    url: safeUrl(body.payload?.url),
    tag: typeof body.payload?.tag === "string" ? body.payload.tag.slice(0, 64) : undefined,
  });

  try {
    const subs = await findSubscriptions(target);
    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (let i = 0; i < subs.length; i += CHUNK_SIZE) {
      const chunk = subs.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map(({ record }) =>
          webpush.sendNotification(
            { endpoint: record.endpoint, keys: record.keys },
            message,
            { TTL: 60 * 60 * 24 }
          )
        )
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          sent++;
          continue;
        }
        const statusCode = (result.reason as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription expired or revoked: remove it so we stop sending to it.
          await deleteSubscriptionByEndpoint(chunk[j].record.endpoint);
          removed++;
        } else {
          failed++;
          console.error("push/send failed:", statusCode ?? "unknown", (result.reason as Error)?.message);
        }
      }
    }

    return NextResponse.json({ ok: true, total: subs.length, sent, failed, removed });
  } catch (err) {
    console.error("push/send error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Send failed." }, { status: 503 });
  }
}
