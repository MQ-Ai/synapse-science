// Minimal Upstash Redis REST client (no SDK dependency).
// Fails closed: if credentials are missing, callers get an error instead of
// silently falling back to in-memory storage (unlike the uploaded-questions
// store), because access and push records must never be lost or leak between
// serverless instances.

export type RedisCommand = (string | number)[];

export async function redisPipeline(commands: RedisCommand[]): Promise<unknown[]> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error("Upstash Redis is not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)");
  }
  if (commands.length === 0) return [];

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Upstash pipeline failed: ${res.status}`);
  }

  const data = (await res.json()) as { result?: unknown; error?: string }[];
  return data.map((entry) => {
    if (entry.error) throw new Error(`Upstash error: ${entry.error}`);
    return entry.result ?? null;
  });
}

export async function redisOne(command: RedisCommand): Promise<unknown> {
  const [result] = await redisPipeline([command]);
  return result;
}
