import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { LocalPath } from "./config.js";

import path from "path";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import friendRequestRoutes from "./routes/friendRequest.route.js";
import aiRoutes from "./routes/ai.route.js";
import analyticsRoutes from "./routes/analytics.route.js";
import { app, server } from "./lib/socket.js";
import { initializeAIBot } from "./controllers/ai.controller.js";

const allowedOrigins = [
  LocalPath,
  "http://localhost:3000",
  "http://localhost:5173", // Vite dev server
  "https://chatterfrontend.onrender.com", // Replace with your actual Vercel URL
  "https://sachink.dev", // If you have a custom domain
];

dotenv.config();

const { PORT } = process.env;
const __dirname = path.resolve();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/friend-requests", friendRequestRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/analytics", analyticsRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    routes: ["auth", "messages", "friend-requests", "ai", "analytics"],
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.send("Hell its working");
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Connect to database BEFORE starting the server
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Initialize AI Bot after successful database connection
    await initializeAIBot();

    // Start the server only after database is ready
    server.listen(PORT, () => {
      console.log(`Server is running on PORT: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();
