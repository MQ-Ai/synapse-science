// Signed access cookie for the email gate.
// Format: "<userId>.<expiresUnixSeconds>.<base64url HMAC-SHA256>"
// The browser can read the cookie but cannot change the userId or expiry
// without invalidating the signature. Requires GATE_SECRET (32+ chars).

import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE = "sage_access";
export const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.GATE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("GATE_SECRET is missing or shorter than 32 characters");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createAccessToken(userId: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const exp = nowSeconds + ACCESS_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the userId if the token is authentic and unexpired, otherwise null. */
export function verifyAccessToken(token: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!userId || !Number.isInteger(exp) || exp <= nowSeconds) return null;

  const expected = Buffer.from(sign(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return userId;
}

export function accessCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ACCESS_TTL_SECONDS,
  };
}
