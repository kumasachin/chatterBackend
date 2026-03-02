import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import http from "http";
import express from "express";
import { LocalPath } from "../config.js";
import { logger } from "./logger.js";
import { redisPub, redisSub } from "./redis.js";

const app = express();
const server = http.createServer(app);

// Build allowed origins once at startup
const IS_PROD = process.env.NODE_ENV === "production";
const socketOrigins = IS_PROD
  ? [LocalPath, process.env.FRONTEND_URL].filter(Boolean)
  : [LocalPath];

const io = new Server(server, {
  cors: {
    origin: socketOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

// ── Redis adapter for multi-instance Socket.io ────────────────────────────────
// Only attempted when REDIS_URL is configured. Falls back to in-memory adapter
// (single-instance mode) when Redis is not available.
(async () => {
  if (!redisPub || !redisSub) {
    logger.info("Socket.io using in-memory adapter (no REDIS_URL)");
    return;
  }
  try {
    await Promise.all([redisPub.connect(), redisSub.connect()]);
    io.adapter(createAdapter(redisPub, redisSub));
    logger.info("Socket.io Redis adapter attached");
  } catch (err) {
    logger.warn(
      { err },
      "Socket.io Redis adapter unavailable — using in-memory adapter"
    );
  }
})();

logger.info({ origins: socketOrigins }, "Socket.io server initialised");

// In-memory map: userId → Set<socketId>
// NOTE: Replace with Redis adapter when running multiple instances
const userSocketMap = {};

export function getReceiverSocketIds(userId) {
  return userSocketMap[userId] ? Array.from(userSocketMap[userId]) : [];
}

io.on("connection", socket => {
  const userId = socket.handshake.query.userId || socket.handshake.auth.userId;

  if (userId) {
    if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
    userSocketMap[userId].add(socket.id);
    // Join personal room so controllers can emit to `user:{userId}` across instances
    socket.join(`user:${userId}`);
    logger.debug({ userId, socketId: socket.id }, "Socket connected");
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    for (const [uid, sockets] of Object.entries(userSocketMap)) {
      sockets.delete(socket.id);
      if (sockets.size === 0) delete userSocketMap[uid];
    }
    logger.debug({ socketId: socket.id }, "Socket disconnected");
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };
