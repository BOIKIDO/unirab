import { Redis } from '@upstash/redis'

let _redis: Redis | null = null
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const redis = getRedis()
    const current = await redis.incr(key)
    if (current === 1) await redis.expire(key, windowSeconds)
    return { allowed: current <= limit, remaining: Math.max(0, limit - current) }
  } catch (err) {
    // Redis unavailable (e.g. instance deleted): fail open so the app keeps working.
    console.warn('[ratelimit] unavailable, allowing request:', err instanceof Error ? err.message : err)
    return { allowed: true, remaining: limit }
  }
}
