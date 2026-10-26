// Data layer for the email access gate and Web Push subscriptions.
//
// Redis key design (stands in for the users / push_subscriptions tables):
//
//   gate:email:{email}          -> userId                 (unique email index)
//   gate:user:{userId}          -> JSON { id, email, name, level, createdAt, lastSeenAt }
//   push:sub:{sha256(endpoint)} -> JSON { userId, endpoint, keys, createdAt }
//   push:user:{userId}:subs     -> SET of subscription hashes   (per-user index)
//   push:all                    -> SET of subscription hashes   (broadcast index)
//
// "Cascade deletion" is implemented in code: deleteUserCascade() and
// deleteSubscriptionByEndpoint() remove every key that points at a record,
// so no orphaned subscription hashes are left behind.

import { createHash, randomUUID } from "node:crypto";
import { redisOne, redisPipeline } from "./redis";

export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  level?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface PushKeys {
  p256dh: string;
  auth: string;
}

export interface SubscriptionRecord {
  userId: string;
  endpoint: string;
  keys: PushKeys;
  createdAt: string;
}

const K = {
  emailIndex: (email: string) => `gate:email:${email}`,
  user: (id: string) => `gate:user:${id}`,
  sub: (hash: string) => `push:sub:${hash}`,
  userSubs: (userId: string) => `push:user:${userId}:subs`,
  allSubs: "push:all",
};

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function hashEndpoint(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

function parseJson<T>(raw: unknown): T | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  return parseJson<UserRecord>(await redisOne(["GET", K.user(id)]));
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const id = await redisOne(["GET", K.emailIndex(normalizeEmail(email))]);
  return typeof id === "string" ? id : null;
}

/** Creates the user if the email is new, otherwise refreshes lastSeenAt. */
export async function upsertUser(
  rawEmail: string,
  profile: { name?: string; level?: string } = {}
): Promise<UserRecord> {
  const email = normalizeEmail(rawEmail);
  const now = new Date().toISOString();

  const newId = randomUUID();
  // SET NX guarantees one user per email even if two requests race.
  const created = await redisOne(["SET", K.emailIndex(email), newId, "NX"]);
  if (created === "OK") {
    const user: UserRecord = {
      id: newId,
      email,
      name: profile.name,
      level: profile.level,
      createdAt: now,
      lastSeenAt: now,
    };
    await redisPipeline([["SET", K.user(newId), JSON.stringify(user)]]);
    return user;
  }

  const existingId = await getUserIdByEmail(email);
  if (!existingId) throw new Error("Email index is inconsistent");
  const existing = await getUserById(existingId);
  if (!existing) throw new Error("User record is missing for an indexed email");

  const updated: UserRecord = {
    ...existing,
    name: profile.name || existing.name,
    level: profile.level || existing.level,
    lastSeenAt: now,
  };
  await redisPipeline([["SET", K.user(existing.id), JSON.stringify(updated)]]);
  return updated;
}

/**
 * Stores a browser push subscription against a user. If the same endpoint was
 * previously linked to another user (shared device, account switch), it is moved.
 */
export async function upsertSubscription(
  userId: string,
  subscription: { endpoint: string; keys: PushKeys }
): Promise<void> {
  const hash = hashEndpoint(subscription.endpoint);
  const previous = parseJson<SubscriptionRecord>(await redisOne(["GET", K.sub(hash)]));

  const record: SubscriptionRecord = {
    userId,
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    createdAt: previous?.createdAt ?? new Date().toISOString(),
  };

  const commands: (string | number)[][] = [];
  if (previous && previous.userId !== userId) {
    commands.push(["SREM", K.userSubs(previous.userId), hash]);
  }
  commands.push(
    ["SET", K.sub(hash), JSON.stringify(record)],
    ["SADD", K.userSubs(userId), hash],
    ["SADD", K.allSubs, hash]
  );
  await redisPipeline(commands);
}

/** Removes one subscription (used for 404/410 responses from push services). */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const hash = hashEndpoint(endpoint);
  const record = parseJson<SubscriptionRecord>(await redisOne(["GET", K.sub(hash)]));
  const commands: (string | number)[][] = [
    ["DEL", K.sub(hash)],
    ["SREM", K.allSubs, hash],
  ];
  if (record) commands.push(["SREM", K.userSubs(record.userId), hash]);
  await redisPipeline(commands);
}

/** Deletes a user, every subscription they own, and the email index entry. */
export async function deleteUserCascade(userId: string): Promise<number> {
  const user = await getUserById(userId);
  const hashes = await redisOne(["SMEMBERS", K.userSubs(userId)]);
  const subHashes = Array.isArray(hashes) ? (hashes as string[]) : [];

  const commands: (string | number)[][] = [];
  for (const hash of subHashes) {
    commands.push(["DEL", K.sub(hash)], ["SREM", K.allSubs, hash]);
  }
  commands.push(["DEL", K.userSubs(userId)], ["DEL", K.user(userId)]);
  if (user) commands.push(["DEL", K.emailIndex(user.email)]);
  await redisPipeline(commands);
  return subHashes.length;
}

export type SubscriptionTarget = { email: string } | { broadcast: true };

/** Loads subscriptions for one user's email, or every subscription for a broadcast. */
export async function findSubscriptions(
  target: SubscriptionTarget
): Promise<{ hash: string; record: SubscriptionRecord }[]> {
  let hashes: string[] = [];

  if ("email" in target) {
    const userId = await getUserIdByEmail(target.email);
    if (!userId) return [];
    const members = await redisOne(["SMEMBERS", K.userSubs(userId)]);
    hashes = Array.isArray(members) ? (members as string[]) : [];
  } else {
    const members = await redisOne(["SMEMBERS", K.allSubs]);
    hashes = Array.isArray(members) ? (members as string[]) : [];
  }
  if (hashes.length === 0) return [];

  const raws = await redisPipeline(hashes.map((h) => ["GET", K.sub(h)]));
  const results: { hash: string; record: SubscriptionRecord }[] = [];
  raws.forEach((raw, i) => {
    const record = parseJson<SubscriptionRecord>(raw);
    if (record) results.push({ hash: hashes[i], record });
  });
  return results;
}
