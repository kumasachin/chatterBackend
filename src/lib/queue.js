/**
 * BullMQ job queues
 *
 * Queues decouple slow I/O (email, image processing) from the HTTP request
 * so response times stay fast even when provideers are slow.
 *
 * Usage (enqueue):
 *   import { emailQueue } from "../lib/queue.js";
 *   await emailQueue.add("send-verification", { to, subject, html });
 *
 * Workers run in the same process for simplicity; move to separate worker
 * processes for production scale-out.
 */

import { Queue, Worker } from "bullmq";
import nodemailer from "nodemailer";
import { redis, REDIS_ENABLED } from "./redis.js";
import { logger } from "./logger.js";

// ── BullMQ requires Redis — skip entirely when Redis is not configured ─────────
if (!REDIS_ENABLED) {
  logger.warn("BullMQ queues disabled — no REDIS_URL configured");
}

// Nodemailer transport (same SMTP config as emailService.js)
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

let emailQueue = null;
let mediaQueue = null;

if (REDIS_ENABLED) {
  const connection = redis;

  // ── Email queue ─────────────────────────────────────────────────────────────
  emailQueue = new Queue("email", {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });

  const emailWorker = new Worker(
    "email",
    async job => {
      const { to, subject, html, text } = job.data;
      await transport.sendMail({ to, subject, html, text });
      logger.info({ jobId: job.id, to }, "Email sent via queue");
    },
    { connection },
  );
  emailWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Email job failed");
  });

  // ── Media queue (image optimisation placeholder) ─────────────────────────────
  mediaQueue = new Queue("media", {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 3_000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  });

  const mediaWorker = new Worker(
    "media",
    async job => {
      logger.info({ jobId: job.id, type: job.name }, "Media job processed");
    },
    { connection },
  );
  mediaWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "Media job failed");
  });

  logger.info("BullMQ workers initialised (email, media)");
}

export { emailQueue, mediaQueue };
