/**
 * Centralised runtime configuration.
 * This file is imported AFTER env.js runs dotenv.config(), so all
 * process.env values are guaranteed to be populated.
 */

/**
 * Primary frontend URL — used for CORS and Socket.io origins.
 * In production, set FRONTEND_URL in your environment/dashboard.
 */
export const LocalPath =
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL || "https://chatterfrontend.onrender.com"
    : process.env.FRONTEND_URL || "http://localhost:5173";
