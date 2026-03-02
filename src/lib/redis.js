import Redis from "ioredis";
import { logger } from "./logger.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ── Singleton factory ─────────────────────────────────────────────────────────
// Creates an ioredis client with sensible defaults and auto-reconnect.
// Pass { lazyConnect: true } for clients that shouldn't auto-connect (e.g. pub/sub pairs).
function createClient (opts = {}) {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
    ...opts,
  });

  client.on("connect", () =>
    logger.info({ url: REDIS_URL }, "Redis connected"),
  );
  client.on("error", err => logger.error({ err }, "Redis error"));
  client.on("reconnecting", () => logger.warn("Redis reconnecting…"));

  return client;
}

// Default client — used for caching, captcha, general SET/GET
export const redis = createClient();

// Dedicated pub/sub pair for Socket.io Redis adapter
export const redisPub = createClient({ lazyConnect: true });
export const redisSub = createClient({ lazyConnect: true });

// ── Cache helpers ─────────────────────────────────────────────────────────────
/**
 * Get a JSON-serialised value from Redis.
 * Returns null on miss or error (never throws).
 */
export async function cacheGet (key) {
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
 */
export async function cacheSet (key, value, ttlSeconds = 60) {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "cacheSet error");
  }
}

/**
 * Delete one or more cache keys.
 */
export async function cacheDel (...keys) {
  try {
    if (keys.length) await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, "cacheDel error");
  }
}
