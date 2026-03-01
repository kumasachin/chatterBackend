import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { censorMessage } from "../utils/messageCensorship.js";
import { generateAIResponse } from "./ai.controller.js";

import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketIds } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const search = req.query.search || "";

    // build query object
    const query = { _id: { $ne: loggedInUserId } }; // exclude current user

    // add search filter if provided
    if (search.trim()) {
      query.name = { $regex: search, $options: "i" }; // case-insensitive search
    }

    // fetch all users including AI bots
    const filteredUsers = await User.find(query)
      .select("-password")
      .sort({ isAIBot: -1, name: 1 }); // AI bots first, then alphabetical order

    // return all users for lazy loading
    res.status(200).json({
      users: filteredUsers,
      totalUsers: filteredUsers.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    // Check if the user to chat with is an AI bot
    const userToChat = await User.findById(userToChatId);
    const isAIBot = userToChat && userToChat.isAIBot;

    // Check if users are friends before allowing to see messages (skip for AI bots)
    if (!isAIBot) {
      const currentUser = await User.findById(myId);
      if (!currentUser.friends.includes(userToChatId)) {
        return res
          .status(403)
          .json({ error: "You can only chat with friends" });
      }
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, recipientId: userToChatId },
        { senderId: userToChatId, recipientId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { content, image } = req.body;
    const { id: recipientId } = req.params;
    const senderId = req.user._id;

    // Check if the recipient is an AI bot
    const recipient = await User.findById(recipientId);
    const isAIBot = recipient && recipient.isAIBot;

    // Check if users are friends before allowing to send messages (skip for AI bots)
    if (!isAIBot) {
      const currentUser = await User.findById(senderId);
      if (!currentUser.friends.includes(recipientId)) {
        return res
          .status(403)
          .json({ error: "You can only send messages to friends" });
      }
    }

    // Apply censorship to message content
    if (content) {
      const censorshipResult = censorMessage(content);

      // Block extremely inappropriate content
      if (censorshipResult.shouldBlock) {
        return res.status(400).json({
          error: "Message blocked due to inappropriate content",
          details:
            "Your message contains content that violates our community guidelines",
        });
      }

      // Use censored content for the message
      req.body.content = censorshipResult.censoredText;
    }

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      recipientId,
      content: req.body.content,
      image: imageUrl,
    });
    await newMessage.save();

    // Only emit to the recipient, not the sender
    const receiverSocketIds = getReceiverSocketIds(recipientId);
    if (receiverSocketIds.length > 0) {
      receiverSocketIds.forEach(socketId => {
        io.to(socketId).emit("newMessage", newMessage);
      });
    }

    // If the recipient is an AI bot, generate and send an AI response
    if (isAIBot && req.body.content) {
      setTimeout(async () => {
        try {
          // Get recent conversation history for context
          const recentMessages = await Message.find({
            $or: [
              { senderId, recipientId },
              { senderId: recipientId, recipientId: senderId },
            ],
          })
            .sort({ createdAt: -1 })
            .limit(6)
            .populate("senderId", "name");

          const conversationHistory = recentMessages.reverse().map(msg => ({
            role:
              msg.senderId._id.toString() === senderId.toString()
                ? "user"
                : "assistant",
            content: msg.content,
          }));

          // Generate AI response
          const aiResponse = await generateAIResponse(
            req.body.content,
            conversationHistory
          );

          // Create AI response message
          const aiMessage = new Message({
            senderId: recipientId, // AI bot is the sender
            recipientId: senderId, // Original sender becomes the recipient
            content: aiResponse,
          });

          await aiMessage.save();

          // Emit AI response to the original sender
          const senderSocketIds = getReceiverSocketIds(senderId);
          if (senderSocketIds.length > 0) {
            senderSocketIds.forEach(socketId => {
              io.to(socketId).emit("newMessage", aiMessage);
            });
          }

          console.log("🤖 AI response sent successfully");
        } catch (error) {
          console.error("Error sending AI response:", error);
        }
      }, 1500); // 1.5 second delay to simulate typing
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
