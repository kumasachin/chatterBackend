import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

// ── Redis store (shared across all limiters) ──────────────────────────────────
// Falls back to in-memory if Redis is unreachable on startup.
// Shared Redis store means limits are enforced correctly even across multiple
// backend instances (important for Render, Railway, k8s etc.)
let store;
try {
  store = new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  });
  logger.info("Rate limiter using Redis store");
} catch (err) {
  logger.warn({ err }, "Rate limiter falling back to in-memory store");
}

/**
 * Reusable rate limiter factory.
 * Produces a limiter that returns a consistent JSON shape on 429.
 */
const createLimiter = options =>
  rateLimit({
    standardHeaders: true, // Return rate limit info in "RateLimit-*" headers
    legacyHeaders: false, // Disable "X-RateLimit-*" headers
    store, // undefined means default in-memory store
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
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// Signup: max 5 accounts per hour from same IP
export const signupLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message:
    "Too many accounts created from this IP. Please try again in an hour.",
});

// Password reset: max 5 per hour
export const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Too many password reset attempts. Please try again in an hour.",
});

// ── General API routes ────────────────────────────────────────────────────
// Relaxed: max 200 requests per minute per IP
export const apiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: "Too many requests. Please slow down.",
});
