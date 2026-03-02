import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import { logger } from "../lib/logger.js";
import { REDIS_ENABLED } from "../lib/redis.js";

// ── Dedicated fast-fail Redis client for rate limiting ────────────────────────
// Only created when REDIS_URL is configured. Each limiter gets its own
// RedisStore with a unique prefix (express-rate-limit v7 forbids sharing one).
// Falls back to in-memory per-instance limiting when Redis is unavailable.
let rlRedis = null;
if (REDIS_ENABLED) {
  try {
    rlRedis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 0,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 2000,
    });
    rlRedis.on("error", () => {
      // suppress per-event noise; degrades to in-memory silently
    });
    await rlRedis.connect().catch(() => {
      rlRedis = null;
      logger.warn("Redis unavailable — rate limiters will use in-memory store");
    });
  } catch {
    rlRedis = null;
  }
}

// ── Per-limiter Redis store factory ──────────────────────────────────────────
// express-rate-limit v7+ forbids sharing a single store instance across multiple
// limiters (ERR_ERL_STORE_REUSE). Each call here creates a fresh RedisStore
// with a unique prefix so every limiter tracks its own counters independently.
function makeStore(prefix) {
  if (!rlRedis) return undefined; // undefined → default in-memory store
  try {
    return new RedisStore({
      sendCommand: (...args) => rlRedis.call(...args),
      prefix: `rl:${prefix}:`,
    });
  } catch (err) {
    logger.warn({ err }, "Rate limiter falling back to in-memory store");
    return undefined;
  }
}

/**
 * Reusable rate limiter factory.
 * Produces a limiter that returns a consistent JSON shape on 429.
 * Each call creates its own store instance to comply with express-rate-limit v7.
 */
const createLimiter = (prefix, options) =>
  rateLimit({
    standardHeaders: true, // Return rate limit info in "RateLimit-*" headers
    legacyHeaders: false, // Disable "X-RateLimit-*" headers
    store: makeStore(prefix),
    handler: (req, res) => {
      res.status(429).json({
        message:
          options.message || "Too many requests. Please try again later.",
        retryAfter: Math.ceil(options.windowMs / 1000 / 60) + " minutes",
      });
    },
    ...options,
  });

// ── Auth routes ─────────────────────────────────────────────────────────────
// Strict: max 10 attempts per 15 min (brute-force protection)
export const authLimiter = createLimiter("auth", {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// Signup: max 5 accounts per hour from same IP
export const signupLimiter = createLimiter("signup", {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message:
    "Too many accounts created from this IP. Please try again in an hour.",
});

// Password reset: max 5 per hour
export const passwordResetLimiter = createLimiter("pwreset", {
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many password reset attempts. Please try again in an hour.",
});

// ── General API routes ────────────────────────────────────────────────────
// Relaxed: max 200 requests per minute per IP
export const apiLimiter = createLimiter("api", {
  windowMs: 60 * 1000,
  max: 200,
  message: "Too many requests. Please slow down.",
});
