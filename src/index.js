// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: env.js MUST be first — loads dotenv before any module reads env vars
// ─────────────────────────────────────────────────────────────────────────────
import "./env.js";

import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import { LocalPath } from "./config.js";
import { connectDB } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { app, server } from "./lib/socket.js";
import { errorHandler } from "./middleware/errorHandler.middleware.js";
import { apiLimiter } from "./middleware/rateLimiter.middleware.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import friendRequestRoutes from "./routes/friendRequest.route.js";
import aiRoutes from "./routes/ai.route.js";
import analyticsRoutes from "./routes/analytics.route.js";
import postRoutes from "./routes/post.route.js";
import { initializeAIBot } from "./controllers/ai.controller.js";
// Initialise BullMQ workers (side-effect import — registers email + media workers)
import "./lib/queue.js";

// ── Allowed CORS origins ─────────────────────────────────────────────────────
// Production origins come from env vars; dev origins are hardcoded (not sensitive)
const extraOrigins = process.env.EXTRA_ALLOWED_ORIGINS
  ? process.env.EXTRA_ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [];

const allowedOrigins = [
  LocalPath,
  "http://localhost:3000",
  "http://localhost:5173",
  ...extraOrigins,
].filter(Boolean);

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(
  helmet({
    // Allow inline styles/scripts in development for convenience
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// General rate limiter on all API routes
app.use("/api/", apiLimiter);

// DB guard — return 503 if MongoDB is not yet connected
app.use("/api/", (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message:
        "Service temporarily unavailable. Database is connecting, please retry in a few seconds.",
    });
  }
  next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friend-requests", friendRequestRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/posts", postRoutes);

// Health check — reports DB state
app.get("/health", (req, res) => {
  const dbState = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    db: dbState[mongoose.connection.readyState] || "unknown",
    routes: ["auth", "messages", "friend-requests", "ai", "analytics", "posts"],
  });
});

app.get("/", (_req, res) => res.send("Chatter API is running"));

// ── SPA static serving (production monorepo deploy) ──────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../chatterFrontend/dist")));
  app.get("*", (_req, res) => {
    res.sendFile(
      path.join(__dirname, "../chatterFrontend", "dist", "index.html")
    );
  });
}

// ── Centralised error handler (must be last middleware) ──────────────────────
app.use(errorHandler);

// ── Bootstrap ────────────────────────────────────────────────────────────────
// Start HTTP server FIRST so Render detects the open port immediately.
// MongoDB connection runs in the background with infinite retries.
// API routes return 503 while the DB is still connecting.
server.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, "Server started");
});

// Connect to DB and initialise AI bot asynchronously
connectDB()
  .then(() => initializeAIBot())
  .catch(err => {
    // connectDB retries forever so this only fires for config errors
    logger.error({ err }, "Fatal: could not connect to MongoDB");
    process.exit(1);
  });
