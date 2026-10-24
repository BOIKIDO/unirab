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
  const redis = getRedis()
  const current = await redis.incr(key)
  if (current === 1) await redis.expire(key, windowSeconds)
  return { allowed: current <= limit, remaining: Math.max(0, limit - current) }
}
