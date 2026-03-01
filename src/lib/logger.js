import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Centralised logger.
 *   - Development: pretty-printed coloured output via pino-pretty
 *   - Production:  JSON lines (machine-readable, ready for log aggregators)
 *
 * Usage:
 *   import { logger } from "../lib/logger.js";
 *   logger.info({ userId }, "User logged in");
 *   logger.error({ err }, "Something went wrong");
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
    // Redact sensitive fields from any log object
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "*.password",
        "*.token",
        "*.resetPasswordToken",
      ],
      censor: "[REDACTED]",
    },
    // Always include timestamp
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname",
      },
    })
    : undefined,
);
