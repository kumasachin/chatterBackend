import express from "express";
import {
  getAIBot,
  sendAIMessage,
  testAIConnection,
} from "../controllers/ai.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// AI Bot routes
router.get("/bot", getAIBot); // Get AI bot user info
router.post("/message", protectRoute, sendAIMessage); // Send message to AI bot
router.get("/test", testAIConnection); // Test AI connection

export default router;
