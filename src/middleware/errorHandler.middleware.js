import { logger } from "../lib/logger.js";

/**
 * Centralised Express error handler.
 * Register LAST in index.js:  app.use(errorHandler)
 *
 * Handles:
 *   - AppError (operational, known HTTP errors)
 *   - Mongoose validation / duplicate key errors
 *   - JWT errors
 *   - Unhandled programming errors (logged, generic 500 returned)
 */
export const errorHandler = (err, req, res, _next) => {
  // Default to 500
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // ── Mongoose duplicate key ──────────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // ── Mongoose validation error ───────────────────────────────────────────
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // ── JWT errors ──────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // ── Log the error ───────────────────────────────────────────────────────
  if (statusCode >= 500) {
    logger.error(
      { err, method: req.method, url: req.originalUrl },
      "Unhandled server error",
    );
  } else {
    logger.warn(
      { statusCode, message, method: req.method, url: req.originalUrl },
      "Client error",
    );
  }

  // Never leak stack traces to the client
  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
