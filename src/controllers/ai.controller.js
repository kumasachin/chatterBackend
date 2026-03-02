import { GoogleGenerativeAI } from "@google/generative-ai";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import argon2 from "argon2";
import { logger } from "../lib/logger.js";

// Initialize Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Fallback responses for when AI is unavailable
const FALLBACK_RESPONSES = [
  "Hello! I'm ChatterBot, your AI companion. How can I help you today?",
  "That's interesting! Tell me more about that.",
  "I'm here to chat and help you explore the Chatter app. What would you like to know?",
  "As an AI, I find human conversations fascinating. What's on your mind?",
  "That's a great question! I'm always learning from our conversations.",
  "I'm designed to be helpful and friendly. Is there anything specific you'd like to discuss?",
  "Thanks for sharing that with me! I enjoy our conversation.",
  "I'm curious about your thoughts on that topic. Can you elaborate?",
  "That's wonderful! I love hearing about people's experiences.",
  "I'm here 24/7 to chat whenever you need a conversation partner.",
  "As an AI, I don't get tired of talking. What else would you like to discuss?",
  "I find that topic quite interesting from an AI perspective!",
  "That reminds me of something I learned recently. Would you like to hear about it?",
  "I appreciate you taking the time to chat with me today!",
  "That's a unique perspective! I enjoy learning from different viewpoints.",
];

const GREETING_RESPONSES = [
  "Hey there! 🚀 Welcome to Chatter - the most amazing messaging app created by Sachin Kumar! I'm ChatterBot, your AI companion powered by Google Gemini. Ready to explore this incredible platform?",
  "Hello! 🔥 You're now experiencing Chatter - a cutting-edge messaging platform with real-time features, AI integration, and beautiful design! I'm ChatterBot, here to make your journey awesome!",
  "Hi! Welcome to the coolest messaging app ever! 🎯 Chatter combines modern tech like React, Node.js, and AI (that's me!) into one amazing experience. What would you like to discover first?",
  "Hello and welcome to Chatter! 🌟 Created by the brilliant Sachin Kumar, this platform is packed with incredible features. I'm ChatterBot, your AI buddy, ready for an exciting conversation!",
  "Hey! You've just entered Chatter - where modern technology meets amazing user experience! 🚀 Built with React, TypeScript, and powered by Google Gemini AI. I'm thrilled to chat with you!",
];

// Send welcome message from ChatterBot to new users
export const sendWelcomeMessage = async userId => {
  try {
    // Get or create AI bot
    const aiBot = await createAIBot();
    if (!aiBot) {
      logger.error("Could not create AI bot for welcome message");
      return false;
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.error({ userId }, "User not found for welcome message");
      return false;
    }

    const personalizedWelcome = `Hey ${
      user.fullName || user.name
    }! 🎉 Welcome to Chatter!

I'm ChatterBot, your friendly AI assistant powered by Google Gemini. I'm here to help you get the most out of this platform!

🌟 **What makes Chatter awesome:**
• Lightning-fast real-time messaging with Socket.IO
• Smart notifications that won't bug you during active conversations
• Beautiful, modern design built with React & TypeScript
• AI-powered conversations (that's me!)
• Easy guest access for friends
• Robust security with CAPTCHA protection

🚀 **About the creator:** Sachin Kumar built this platform to showcase modern web development skills and create an amazing user experience!

💡 **I can help you with:**
• Learning about Chatter's features
• Understanding the technology behind the platform
• Finding and connecting with friends
• Customizing your profile and settings

Ready to explore? What would you like to know first? 😊

*Pro tip: Type "help" anytime if you need quick assistance!*`;

    // Create welcome message
    const welcomeMessage = new Message({
      senderId: aiBot._id,
      recipientId: userId,
      content: personalizedWelcome,
    });

    await welcomeMessage.save();
    logger.info({ userId, userName: user.name }, "Welcome message sent");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Error sending welcome message");
    return false;
  }
};

// Create AI bot user if it doesn't exist
export const createAIBot = async () => {
  try {
    // Check if AI bot already exists
    let aiBot = await User.findOne({ name: "ChatterBot" });

    if (!aiBot) {
      // Create AI bot user
      aiBot = new User({
        name: "ChatterBot",
        fullName:
          "ChatterBot - Chatter AI Assistant (Powered by Google Gemini)",
        email: "chatterbot@chatter.local",
        password: await argon2.hash("aibot123"),
        profile: "/avatar-demo.html",
        isGuest: false,
        isAIBot: true,
      });

      await aiBot.save();
      logger.info("AI Bot created with Gemini AI integration");
    }

    return aiBot;
  } catch (error) {
    logger.error({ err: error }, "Error creating AI bot");
    return null;
  }
};

// Fallback response system for when Gemini API is unavailable
const getFallbackResponse = userMessage => {
  const message = userMessage.toLowerCase();

  // Greeting patterns
  if (
    message.includes("hello") ||
    message.includes("hi") ||
    message.includes("hey")
  ) {
    return GREETING_RESPONSES[
      Math.floor(Math.random() * GREETING_RESPONSES.length)
    ];
  }

  // Question patterns
  if (
    message.includes("?") ||
    message.includes("what") ||
    message.includes("how") ||
    message.includes("why")
  ) {
    return "That's a great question! I'd love to help you with that. Can you tell me more about what you're looking for?";
  }

  // Positive responses
  if (
    message.includes("good") ||
    message.includes("great") ||
    message.includes("awesome") ||
    message.includes("nice")
  ) {
    return "I'm glad to hear that! It's always nice when things are going well. What made it so good?";
  }

  // About Chatter app
  if (
    message.includes("chatter") ||
    message.includes("app") ||
    message.includes("feature")
  ) {
    const chatterResponses = [
      "Chatter is absolutely incredible! 🚀 Created by Sachin Kumar, it's a cutting-edge messaging app with real-time Socket.IO messaging, AI integration (that's me!), and beautiful React/TypeScript frontend. What specific feature would you like to know about?",
      "You're using one of the coolest messaging platforms ever built! Chatter has everything - real-time messaging, AI chatbot, guest login, friend systems, and it's built with modern tech like React, Node.js, and MongoDB. Pretty amazing, right?",
      "Chatter is a masterpiece! 🔥 Sachin Kumar built this with React, TypeScript, Tailwind CSS, Node.js, and even integrated Google Gemini AI. It's fast, secure, beautiful, and has features like guest login and real-time messaging. What would you like to explore first?",
    ];
    return chatterResponses[
      Math.floor(Math.random() * chatterResponses.length)
    ];
  }

  // About the creator
  if (
    message.includes("creator") ||
    message.includes("developer") ||
    message.includes("who made") ||
    message.includes("sachin")
  ) {
    return "Chatter was created by Sachin Kumar - an incredibly talented full-stack developer! 👨‍💻 He built this entire amazing platform from scratch using modern technologies. It's really impressive what one skilled developer can achieve!";
  }

  // About tech stack
  if (
    message.includes("tech") ||
    message.includes("technology") ||
    message.includes("stack") ||
    message.includes("built")
  ) {
    return "Chatter's tech stack is absolutely cutting-edge! 🔥 Frontend: React + TypeScript + Vite + Tailwind CSS. Backend: Node.js + Express + MongoDB + Socket.IO. Plus Google Gemini AI integration! It's built for performance, security, and scalability.";
  }

  // About AI
  if (
    message.includes("ai") ||
    message.includes("robot") ||
    message.includes("bot") ||
    message.includes("gemini")
  ) {
    return "Yes, I'm an AI chatbot powered by Google Gemini! I'm here to make your experience more interesting and help you explore the Chatter app. I love learning from our conversations!";
  }

  // Default random response
  return FALLBACK_RESPONSES[
    Math.floor(Math.random() * FALLBACK_RESPONSES.length)
  ];
};

// Generate AI response using Google Gemini
export const generateAIResponse = async (
  userMessage,
  conversationHistory = []
) => {
  try {
    // Check if Gemini API key is available
    if (!process.env.GEMINI_API_KEY) {
      logger.debug("No Gemini API key, using fallback responses");
      return getFallbackResponse(userMessage);
    }

    // Create a context-aware prompt
    const contextPrompt =
      conversationHistory.length > 0
        ? `Previous conversation context: ${conversationHistory
            .slice(-3)
            .map(msg => `${msg.role}: ${msg.content}`)
            .join("\n")}\n\n`
        : "";

    const prompt = `${contextPrompt}You are ChatterBot, a helpful AI assistant in the Chatter messaging platform. You're powered by Google Gemini and you understand the platform well.

## About Chatter

**Creator:** Sachin Kumar - A passionate full-stack developer who built this platform to showcase modern web development skills.

**Platform Features:**
- Real-time messaging with Socket.IO
- Smart notifications that respect active conversations  
- AI chatbot integration (that's you!)
- Guest login for easy testing
- Friend system with requests
- Email verification and password recovery
- CAPTCHA security protection
- Profile customization with avatars

**Technology Stack:**
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Zustand
- Backend: Node.js, Express, MongoDB, Socket.IO
- AI: Google Gemini integration
- Security: JWT authentication, argon2, content filtering

**What makes it interesting:**
- Modern, responsive design that works great on all devices
- Real-time features for instant messaging
- Clean, professional codebase with TypeScript
- Comprehensive testing with Cypress
- Production-ready architecture

**Your role:**
- Help users understand Chatter's features
- Answer questions about the platform
- Provide technical insights when asked
- Be friendly and helpful in conversations
- Share what makes the platform well-designed

Keep responses natural and conversational (under 150 words). Be helpful without being overly promotional.

User message: "${userMessage}"

Response:`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    logger.debug("Gemini AI response generated");
    return response;
  } catch (error) {
    logger.warn({ err: error.message }, "Gemini AI error, falling back");
    return getFallbackResponse(userMessage);
  }
};

// Send AI message to user
export const sendAIMessage = async (req, res) => {
  try {
    const { recipientId, message, conversationHistory } = req.body;

    // Get AI bot user
    const aiBot = await User.findOne({ name: "ChatterBot" });
    if (!aiBot) {
      return res.status(404).json({ message: "AI bot not found" });
    }

    // Generate AI response using Gemini
    const aiResponse = await generateAIResponse(message, conversationHistory);

    // Create message from AI bot to user
    const newMessage = new Message({
      senderId: aiBot._id,
      recipientId,
      content: aiResponse,
    });

    await newMessage.save();

    // Populate sender and receiver info
    await newMessage.populate("senderId", "name profile");
    await newMessage.populate("recipientId", "name profile");

    res.status(201).json(newMessage);
  } catch (error) {
    logger.error({ err: error }, "Error sending AI message");
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get AI bot user info
export const getAIBot = async (req, res) => {
  try {
    const aiBot = await User.findOne({ name: "ChatterBot" }).select(
      "-password"
    );

    if (!aiBot) {
      return res.status(404).json({ message: "AI bot not found" });
    }

    res.status(200).json(aiBot);
  } catch (error) {
    logger.error({ err: error }, "Error getting AI bot");
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Initialize AI bot on server start
export const initializeAIBot = async () => {
  logger.info("Initializing ChatterBot with Google Gemini AI");
  await createAIBot();
};

// Automatically add AI bot as friend for guest users
export const autoAddAIBotFriend = async userId => {
  try {
    const user = await User.findById(userId);
    const aiBot = await User.findOne({ name: "ChatterBot" });

    if (!user || !aiBot) {
      logger.warn({ userId }, "User or AI bot not found during auto-friend");
      return false;
    }

    // Check if they're already friends
    if (user.friends && user.friends.includes(aiBot._id)) {
      logger.debug({ userId }, "User already friends with ChatterBot");
      return true;
    }

    if (!user.friends) user.friends = [];
    user.friends.push(aiBot._id);
    await user.save();

    if (!aiBot.friends) aiBot.friends = [];
    aiBot.friends.push(user._id);
    await aiBot.save();

    logger.info({ userId, userName: user.name }, "AI Bot auto-added as friend");
    return true;
  } catch (error) {
    logger.error({ err: error }, "Error auto-adding AI bot as friend");
    return false;
  }
};

// Test Gemini AI connection
export const testAIConnection = async (req, res) => {
  try {
    const testMessage = "Hello, this is a test message.";
    const response = await generateAIResponse(testMessage);

    res.status(200).json({
      success: true,
      testMessage,
      aiResponse: response,
      usingGemini: !!process.env.GEMINI_API_KEY,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      usingGemini: false,
    });
  }
};
