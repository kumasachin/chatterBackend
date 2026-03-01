import rateLimit from "express-rate-limit";

/**
 * Reusable rate limiter factory.
 * Produces a limiter that returns a consistent JSON shape on 429.
 */
const createLimiter = (options) =>
  rateLimit({
    standardHeaders: true, // Return rate limit info in "RateLimit-*" headers
    legacyHeaders: false,  // Disable "X-RateLimit-*" headers
    handler: (req, res) => {
      res.status(429).json({
        message: options.message || "Too many requests. Please try again later.",
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
  message: "Too many accounts created from this IP. Please try again in an hour.",
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
