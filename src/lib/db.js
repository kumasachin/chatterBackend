import mongoose from "mongoose";
import { logger } from "./logger.js";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });

      logger.info({ host: conn.connection.host }, "MongoDB connected");
      return conn;
    } catch (error) {
      lastError = error;
      logger.warn(
        { attempt, maxRetries: MAX_RETRIES, err: error.message },
        "MongoDB connection attempt failed",
      );

      if (attempt < MAX_RETRIES) {
        logger.info(`Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  logger.error("All MongoDB connection attempts failed");
  throw lastError;
};
