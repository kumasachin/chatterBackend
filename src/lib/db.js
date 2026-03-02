import mongoose from "mongoose";
import { logger } from "./logger.js";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  let delayMs = 5000;

  while (true) {
    attempt++;
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      logger.info({ host: conn.connection.host }, "MongoDB connected");
      return conn;
    } catch (error) {
      logger.warn(
        { attempt, delayMs, err: error.message },
        "MongoDB connection attempt failed — will retry"
      );
      await sleep(delayMs);
      // Exponential backoff capped at 60s
      delayMs = Math.min(delayMs * 2, 60_000);
    }
  }
};
