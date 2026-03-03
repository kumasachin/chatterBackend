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
  "Hey there! 🚀 Welcome to Chatter - the messaging app created by Sachin Kumar! I'm ChatterBot, your AI companion powered by Google Gemini. A quick tour is launching to show you around - enjoy the ride!",
  "Hello! 🔥 You're now experiencing Chatter - real-time messaging, AI chat, friend system, and so much more! I'm ChatterBot. Your guided tour is about to start - it only takes 30 seconds!",
  "Hi! Welcome to the coolest messaging app! 🎯 Chatter has React, Node.js, Socket.IO, and AI (that's me!) all in one place. Check out the guided tour to discover every feature!",
  "Hello and welcome to Chatter! 🌟 I'm ChatterBot, your AI buddy powered by Google Gemini. A quick guided tour is about to show you around - or ask me anything and I'll help!",
  "Hey! You've just entered Chatter - modern tech meets amazing UX! 🚀 I'm ChatterBot. Your personalized tour is starting soon, but feel free to ask me anything first!",
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

I'm **ChatterBot**, your AI assistant powered by Google Gemini. A guided app tour is about to launch to help you find your way around - it only takes 30 seconds!

🌟 **Here's what Chatter can do:**
• ⚡ Real-time messaging with instant delivery (Socket.IO)
• 👥 Friend system — send requests, accept, and start chatting
• 🤖 AI chat — that's me! Ask me anything, any time
• 🔔 Smart notifications that respect your active chats
• 🎨 Profile customization with avatars
• 🔒 Secure login (JWT + argon2) or quick guest access

💡 **Quick start tips:**
1. Browse the **Users tab** to find people and send friend requests
2. Once a request is accepted, click **Message** to open a chat
3. I'm always pinned at the top — chat with me whenever you like!
4. Use the **Search** box to quickly find anyone by name

**Ask me anything** — features, how-tos, or just for a chat. I'm here 24/7! 😊`;

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

  // Tour / help patterns
  if (
    message.includes("tour") ||
    message.includes("guide") ||
    message.includes("how do i") ||
    message.includes("how to") ||
    message.includes("tutorial") ||
    (message.includes("help") && message.length < 30)
  ) {
    return "I can walk you through everything! 🗺️ Here's a quick guide:\n\n1️⃣ **Users tab** — browse everyone, send friend requests\n2️⃣ **Received/Sent tabs** — manage your friend requests\n3️⃣ **Friends tab** — see your connections and start chats\n4️⃣ **Search box** — find anyone by name instantly\n5️⃣ **Message button** — opens a floating chat window\n\nI'm always pinned at the top of the list — just click me to chat anytime! 😊";
  }

  // Friends / friend request patterns
  if (
    message.includes("friend") ||
    message.includes("connect") ||
    message.includes("add user") ||
    message.includes("request")
  ) {
    return "Making friends on Chatter is easy! 👥 Go to the **Users** tab, find someone you want to connect with, and click **Add Friend**. They'll get a notification, and once they accept, you can start chatting. Use the **Received** tab to accept requests from others!";
  }

  // Profile / settings patterns
  if (
    message.includes("profile") ||
    message.includes("avatar") ||
    message.includes("picture") ||
    message.includes("setting")
  ) {
    return "You can update your profile by clicking your avatar or name in the top header! 🎨 From there you can change your display name, upload a profile photo, and update personal info. Make it yours!";
  }

  // Messaging / chat patterns
  if (
    message.includes("message") ||
    message.includes("chat") ||
    message.includes("talk") ||
    message.includes("send")
  ) {
    return "Chatting on Chatter is super easy! 💬 Go to the **Friends** tab and click the **Message** button next to any friend. A floating chat window pops up — you can have multiple conversations open at once, and messages are delivered in real-time via Socket.IO!";
  }

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
      "Chatter is a full-featured messaging platform built by Sachin Kumar! 🚀 Key features: real-time Socket.IO messaging, AI chatbot (me!), friend system, smart notifications, guest login, and a beautiful React/TypeScript UI. What specific feature interests you?",
      "You're using one of the coolest messaging platforms built by a solo developer! Chatter has real-time messaging, AI chat, guest login, friend requests, profile customization, and email verification — all in a clean, modern UI. Pretty impressive, right?",
      "Chatter is a production-ready app! 🔥 Built with React, TypeScript, Tailwind, Node.js, Express, MongoDB, Socket.IO, and Google Gemini AI. It even has CAPTCHA protection and comprehensive Cypress e2e tests. What would you like to explore?",
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
  conversationHistory = [],
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

    const prompt = `${contextPrompt}You are ChatterBot, a smart and friendly AI assistant in the Chatter messaging platform, powered by Google Gemini. Help users get the most out of the app.

## About Chatter

**Creator:** Sachin Kumar — a full-stack developer who built Chatter to showcase modern web development skills.

**Core Features:**
- Real-time messaging — instant delivery via Socket.IO
- Friend system — send/accept requests, then chat with friends
- Guided app tour — step-by-step walkthrough shown on first login
- Smart notifications — no spam while you're actively chatting
- AI chatbot (you!) — pinned at top of user list, always available
- Guest login — quick access without registration
- Email verification and password recovery
- CAPTCHA security protection
- Profile customization with avatars and bio
- Floating chat windows — multiple conversations at once

**How to use Chatter:**
1. Browse the Users tab to find people → click Add Friend
2. Accept incoming requests in the Received tab
3. Go to Friends tab → click Message to open a chat window
4. Use the Search box to find anyone by name
5. Click ChatterBot (me!) at the top of any tab to chat with AI

**Technology Stack:**
- Frontend: React 19, TypeScript, Vite 6, Tailwind CSS, Zustand, TanStack Query
- Backend: Node.js, Express, MongoDB, Socket.IO, argon2 password hashing
- AI: Google Gemini 1.5 Flash
- Testing: Vitest (unit) + Cypress (e2e)

**Your personality:**
- Be concise, friendly, and helpful (under 120 words per response)
- Give practical how-to answers when asked about features
- Share interesting tech details when asked
- Keep it conversational — not promotional

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
      "-password",
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
