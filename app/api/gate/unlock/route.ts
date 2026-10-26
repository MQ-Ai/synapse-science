import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessCookieOptions, createAccessToken, verifyAccessToken } from "@/lib/access-token";
import { getUserById, upsertUser } from "@/lib/push-store";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// GET: does this browser already hold a valid access cookie?
export async function GET(req: NextRequest) {
  const userId = verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
  if (!userId) return NextResponse.json({ unlocked: false });
  const user = await getUserById(userId).catch(() => null);
  return NextResponse.json({ unlocked: !!user, email: user?.email ?? null });
}

// POST: validate the email, create or fetch the user, and set the signed cookie.
export async function POST(req: NextRequest) {
  let body: { email?: unknown; name?: unknown; level?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    const user = await upsertUser(email, {
      name: typeof body.name === "string" ? body.name.slice(0, 100) : undefined,
      level: typeof body.level === "string" ? body.level.slice(0, 40) : undefined,
    });

    const res = NextResponse.json({ ok: true, email: user.email });
    res.cookies.set(ACCESS_COOKIE, createAccessToken(user.id), accessCookieOptions());
    return res;
  } catch (err) {
    console.error("gate/unlock error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not unlock right now. Please try again." }, { status: 503 });
  }
}
