import { Redis } from '@upstash/redis'

let _redis: Redis | null = null
let redisDown = false
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv()
  return _redis
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  if (redisDown) return { allowed: true, remaining: limit }
  try {
    const redis = getRedis()
    const current = await redis.incr(key)
    if (current === 1) await redis.expire(key, windowSeconds)
    return { allowed: current <= limit, remaining: Math.max(0, limit - current) }
  } catch (err) {
    // Redis unavailable (e.g. instance deleted): fail open and skip Redis for
    // the rest of this instance's lifetime so every request isn't slowed by a
    // DNS/connection timeout.
    redisDown = true
    console.warn('[ratelimit] unavailable, allowing requests:', err instanceof Error ? err.message : err)
    return { allowed: true, remaining: limit }
  }
}
