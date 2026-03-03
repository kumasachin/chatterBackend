import mongoose from "mongoose";
import { logger } from "./logger.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Exposed so the /health endpoint can surface the actual connection error
export let lastDbError = null;
export let dbAttempts = 0;

/**
 * Connect with infinite exponential-backoff retries.
 * Caps at 60s between attempts so we don't spam Atlas.
 * The server starts BEFORE this resolves — DB is optional at boot.
 */
export const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  let attempt = 0;
  let delayMs = 1000; // start fast; backs off to 60 s max

  while (true) {
    attempt++;
    dbAttempts = attempt;
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      lastDbError = null;
      logger.info({ host: conn.connection.host }, "MongoDB connected");
      return conn;
    } catch (error) {
      lastDbError = error.message;
      logger.warn(
        { attempt, delayMs, err: error.message },
        "MongoDB connection attempt failed — will retry",
      );
      await sleep(delayMs);
      // Exponential backoff capped at 60s
      delayMs = Math.min(delayMs * 2, 60_000);
    }
  }
};
