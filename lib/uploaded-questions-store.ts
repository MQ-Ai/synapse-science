// Persistent store using Upstash Redis (free tier).
// Falls back to in-memory array in dev when env vars are absent.

const REDIS_KEY = "uploaded-questions";

async function redisCall(method: "GET" | "SET", ...args: string[]) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(`${url}/${method}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const json = await res.json() as { result: string | null };
  return json.result;
}

// In-memory fallback for local dev without Redis
const memStore: object[] = [];

export async function getStore(): Promise<object[]> {
  try {
    const raw = await redisCall("GET", REDIS_KEY);
    if (raw) return JSON.parse(raw) as object[];
  } catch { /* fall through */ }
  return memStore;
}

export async function appendToStore(question: object): Promise<void> {
  try {
    const existing = await getStore();
    existing.push(question);
    const serialized = JSON.stringify(existing);
    await redisCall("SET", REDIS_KEY, serialized);
    // Also keep memStore in sync for in-process reads
    memStore.splice(0, memStore.length, ...existing);
  } catch { /* non-fatal */ }
}
