// In-memory sliding window. It is per server instance, so on serverless hosting it only
// slows bursts; Supabase Auth's own email rate limit remains the durable backstop.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return { allowed: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    for (const [storedKey, timestamps] of hits) {
      if (timestamps.every((timestamp) => now - timestamp >= windowMs)) hits.delete(storedKey);
    }
  }

  return { allowed: true, retryAfter: 0 };
}
