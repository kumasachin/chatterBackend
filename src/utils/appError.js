/**
 * AppError — typed, operational HTTP error.
 *
 * Throw this anywhere in the app to produce a clean JSON error response
 * without leaking stack traces to clients.
 *
 * Usage:
 *   throw new AppError("Email already exists", 409);
 *   throw new AppError("Unauthorized", 401);
 */
export class AppError extends Error {
  /**
   * @param {string} message   Human-readable message sent to the client
   * @param {number} statusCode HTTP status code (4xx client, 5xx server)
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}
