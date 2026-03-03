import Redis from "ioredis";
import { logger } from "./logger.js";

// ── Redis is optional ─────────────────────────────────────────────────────────
// If REDIS_URL is not set in the environment (e.g. Render free tier without an
// add-on), skip creating any clients and silently degrade:
//   • cacheGet → returns null   (cache miss)
//   • cacheSet / cacheDel → no-op
//   • Socket.io adapter → falls back to in-memory (single-instance)
//   • BullMQ queues → disabled  (email sent inline; media jobs skipped)
//   • Rate limiters  → in-memory per-instance
export const REDIS_ENABLED = Boolean(process.env.REDIS_URL);

if (!REDIS_ENABLED) {
  logger.warn(
    "REDIS_URL not configured — Redis features disabled, using in-memory fallbacks",
  );
}

// ── Singleton factory ─────────────────────────────────────────────────────────
function createClient(opts = {}) {
  if (!REDIS_ENABLED) return null;

  const client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    ...opts,
  });

  client.on("connect", () =>
    logger.info({ url: process.env.REDIS_URL }, "Redis connected"),
  );
  client.on("error", err => logger.error({ err }, "Redis error"));
  client.on("reconnecting", () => logger.warn("Redis reconnecting…"));

  return client;
}

// Default client — used for caching, captcha, general SET/GET
export const redis = createClient();

// Dedicated pub/sub pair for Socket.io Redis adapter (lazy — connected in socket.js)
export const redisPub = createClient({ lazyConnect: true });
export const redisSub = createClient({ lazyConnect: true });

// ── Cache helpers ─────────────────────────────────────────────────────────────
/**
 * Get a JSON-serialised value from Redis.
 * Returns null on miss, error, or when Redis is disabled.
 */
export async function cacheGet(key) {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn({ err, key }, "cacheGet error");
    return null;
  }
}

/**
 * Store a JSON-serialisable value in Redis with a TTL (seconds).
 * No-op when Redis is disabled.
 */
export async function cacheSet(key, value, ttlSeconds = 60) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "cacheSet error");
  }
}

/**
 * Delete one or more cache keys.
 * No-op when Redis is disabled.
 */
export async function cacheDel(...keys) {
  if (!redis) return;
  try {
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, "cacheDel error");
  }
}
