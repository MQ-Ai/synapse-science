import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/access-token";
import { getUserById, normalizeEmail, upsertSubscription } from "@/lib/push-store";

export const runtime = "nodejs";

interface SubscriptionBody {
  email?: unknown; // optional cross-check only; identity comes from the signed cookie
  subscription?: {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
}

export async function POST(req: NextRequest) {
  // Identity comes from the signed access cookie, never from the request body,
  // so a client cannot attach a subscription to someone else's email.
  const userId = verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "Unlock access first." }, { status: 401 });
  }

  let body: SubscriptionBody;
  try {
    body = (await req.json()) as SubscriptionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sub = body.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;

  if (
    typeof endpoint !== "string" || endpoint.length > 2048 || !endpoint.startsWith("https://") ||
    typeof p256dh !== "string" || p256dh.length === 0 || p256dh.length > 200 ||
    typeof auth !== "string" || auth.length === 0 || auth.length > 200
  ) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "Unlock access first." }, { status: 401 });
    }
    if (typeof body.email === "string" && normalizeEmail(body.email) !== user.email) {
      return NextResponse.json({ error: "Email does not match this session." }, { status: 403 });
    }

    await upsertSubscription(userId, { endpoint, keys: { p256dh, auth } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push/subscribe error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not save subscription." }, { status: 503 });
  }
}
