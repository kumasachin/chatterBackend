import { Server } from "socket.io";
import http from "http";
import express from "express";
import { LocalPath } from "../config.js";
import { logger } from "./logger.js";

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

logger.info({ origins: socketOrigins }, "Socket.io server initialised");

// In-memory map: userId → Set<socketId>
// NOTE: Replace with Redis adapter when running multiple instances
const userSocketMap = {};

export function getReceiverSocketIds(userId) {
  return userSocketMap[userId] ? Array.from(userSocketMap[userId]) : [];
}

io.on("connection", (socket) => {
  const userId =
    socket.handshake.query.userId || socket.handshake.auth.userId;

  if (userId) {
    if (!userSocketMap[userId]) userSocketMap[userId] = new Set();
    userSocketMap[userId].add(socket.id);
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
