import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Constructor-style mock so `new User(...)` / `new Message(...)` work,
// while static methods like findOne / create are also available.
const mockUserModel = Object.assign(
  jest
    .fn()
    .mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) })),
  { findOne: jest.fn(), create: jest.fn(), findById: jest.fn() }
);

const mockMessageModel = Object.assign(
  jest
    .fn()
    .mockImplementation(() => ({ save: jest.fn().mockResolvedValue({}) })),
  { create: jest.fn(), find: jest.fn(), countDocuments: jest.fn() }
);

const mockHash = jest.fn();

// Mock modules
jest.unstable_mockModule("../src/models/user.model.js", () => ({
  default: mockUserModel,
}));

jest.unstable_mockModule("../src/models/message.model.js", () => ({
  default: mockMessageModel,
}));

jest.unstable_mockModule("argon2", () => ({
  default: {
    verify: jest.fn().mockResolvedValue(true),
    hash: mockHash,
  },
}));

jest.unstable_mockModule("../src/lib/redis.js", () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
  redis: {},
  redisPub: {},
  redisSub: {},
}));

jest.unstable_mockModule("../src/utils/messageCensorship.js", () => ({
  validateUserName: jest.fn().mockReturnValue({ isValid: true }),
}));

jest.unstable_mockModule("../src/lib/cloudinary.js", () => ({
  default: {
    uploader: {
      upload: jest.fn().mockResolvedValue({ secure_url: "http://img" }),
    },
  },
}));

// Import after mocking
const { sendWelcomeMessage, createAIBot } =
  await import("../../src/controllers/ai.controller.js");

describe("AI Controller - Welcome Message System", () => {
  // Shared fixtures — accessible in all nested describes
  const mockUser = {
    _id: "user123",
    name: "testuser",
    fullName: "Test User",
    email: "test@example.com",
  };

  const mockAIBot = {
    _id: "aibot123",
    name: "ChatterBot",
    fullName: "ChatterBot - Chatter AI Assistant (Powered by Google Gemini)",
    isAIBot: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockHash.mockResolvedValue("hashedpassword");
  });

  describe("sendWelcomeMessage", () => {
    it("should send personalized welcome message to new user", async () => {
      // Mock database operations
      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(mockUser);

      const mockMessage = { save: jest.fn().mockResolvedValue(true) };
      mockMessageModel.mockImplementation(() => mockMessage);

      const result = await sendWelcomeMessage(mockUser._id);

      // Verify AI bot lookup
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        name: "ChatterBot",
      });

      // Verify user lookup
      expect(mockUserModel.findById).toHaveBeenCalledWith(mockUser._id);

      // Verify message creation via constructor
      expect(mockMessageModel).toHaveBeenCalledWith({
        senderId: mockAIBot._id,
        recipientId: mockUser._id,
        content: expect.stringContaining(mockUser.fullName),
      });

      // Verify message was saved
      expect(mockMessage.save).toHaveBeenCalled();

      expect(result).toBe(true);
    });

    it("should include comprehensive welcome content", async () => {
      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(mockUser);

      const mockMessage = { save: jest.fn().mockResolvedValue(true) };
      mockMessageModel.mockImplementation(() => mockMessage);

      await sendWelcomeMessage(mockUser._id);

      const messageCall = mockMessageModel.mock.calls[0][0];
      const welcomeMessage = messageCall.content;

      // Verify personalization
      expect(welcomeMessage).toContain(mockUser.fullName);
      expect(welcomeMessage).toContain("Welcome to Chatter");

      // Verify ChatterBot introduction
      expect(welcomeMessage).toContain("ChatterBot");
      expect(welcomeMessage).toContain("Google Gemini");

      // Verify feature highlights reflect new guided-tour welcome message
      expect(welcomeMessage).toContain("Socket.IO");
      expect(welcomeMessage).toContain("Smart notifications");
      expect(welcomeMessage).toContain("friend");
      expect(welcomeMessage).toContain("guest access");
      expect(welcomeMessage).toContain("Search");

      // Verify call to action / help prompt
      expect(welcomeMessage).toContain("Ask me anything");
    });

    it("should handle user with only name (no fullName)", async () => {
      const userWithoutFullName = {
        _id: "user456",
        name: "simpleuser",
        fullName: null,
        email: "simple@example.com",
      };

      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(userWithoutFullName);

      const mockMessage = { save: jest.fn().mockResolvedValue(true) };
      mockMessageModel.mockImplementation(() => mockMessage);

      await sendWelcomeMessage(userWithoutFullName._id);

      const messageCall = mockMessageModel.mock.calls[0][0];
      const welcomeMessage = messageCall.content;

      // Should use name when fullName is not available
      expect(welcomeMessage).toContain(userWithoutFullName.name);
    });

    it("should return false when AI bot cannot be created", async () => {
      mockUserModel.findOne.mockResolvedValue(null); // No existing bot
      mockUserModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error("DB Error")),
      }));

      const result = await sendWelcomeMessage(mockUser._id);

      expect(result).toBe(false);
    });

    it("should return false when user is not found", async () => {
      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(null);

      const result = await sendWelcomeMessage("nonexistent-user");

      expect(result).toBe(false);
    });

    it("should return false when message save fails", async () => {
      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(mockUser);

      const mockMessage = {
        save: jest.fn().mockRejectedValue(new Error("Save failed")),
      };
      mockMessageModel.mockImplementation(() => mockMessage);

      const result = await sendWelcomeMessage(mockUser._id);

      expect(result).toBe(false);
    });
  });

  describe("createAIBot", () => {
    it("should create AI bot if it does not exist", async () => {
      mockUserModel.findOne.mockResolvedValue(null); // Bot doesn't exist

      const mockBot = {
        save: jest.fn().mockResolvedValue(true),
        _id: "newbot123",
        name: "ChatterBot",
      };
      mockUserModel.mockImplementation(() => mockBot);

      const result = await createAIBot();

      // Verify bot lookup
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        name: "ChatterBot",
      });

      // Verify bot creation
      expect(mockUserModel).toHaveBeenCalledWith({
        name: "ChatterBot",
        fullName:
          "ChatterBot - Chatter AI Assistant (Powered by Google Gemini)",
        email: "chatterbot@chatter.local",
        password: "hashedpassword",
        profile: "/avatar-demo.html",
        isGuest: false,
        isAIBot: true,
      });

      // Verify bot was saved
      expect(mockBot.save).toHaveBeenCalled();

      expect(result).toBe(mockBot);
    });

    it("should return existing AI bot if it already exists", async () => {
      const existingBot = {
        _id: "existingbot123",
        name: "ChatterBot",
        isAIBot: true,
      };

      mockUserModel.findOne.mockResolvedValue(existingBot);

      const result = await createAIBot();

      // Verify only lookup was performed
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        name: "ChatterBot",
      });
      expect(mockUserModel).not.toHaveBeenCalled(); // No new bot created

      expect(result).toBe(existingBot);
    });

    it("should handle bot creation errors gracefully", async () => {
      mockUserModel.findOne.mockResolvedValue(null);
      mockUserModel.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error("Creation failed")),
      }));

      const result = await createAIBot();

      expect(result).toBe(null);
    });
  });

  describe("Welcome Message Content Quality", () => {
    it("should maintain professional tone for business users", async () => {
      const businessUser = {
        _id: "biz123",
        name: "ceo",
        fullName: "CEO Johnson",
        email: "ceo@company.com",
      };

      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(businessUser);

      const mockMessage = { save: jest.fn().mockResolvedValue(true) };
      mockMessageModel.mockImplementation(() => mockMessage);

      await sendWelcomeMessage(businessUser._id);

      const messageCall = mockMessageModel.mock.calls[0][0];
      const welcomeMessage = messageCall.content;

      // Should mention ChatterBot and platform
      expect(welcomeMessage).toContain("ChatterBot");
      expect(welcomeMessage).toContain("Welcome to Chatter");
      expect(welcomeMessage).toContain(businessUser.fullName);
    });

    it("should highlight technical achievements", async () => {
      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(mockUser);

      const mockMessage = { save: jest.fn().mockResolvedValue(true) };
      mockMessageModel.mockImplementation(() => mockMessage);

      await sendWelcomeMessage(mockUser._id);

      const messageCall = mockMessageModel.mock.calls[0][0];
      const welcomeMessage = messageCall.content;

      // Should showcase technical stack present in new welcome message
      const technicalTerms = [
        "Socket.IO",
        "Google Gemini",
        "Smart notifications",
        "argon2",
      ];

      technicalTerms.forEach(term => {
        expect(welcomeMessage).toContain(term);
      });
    });

    it("should provide clear next steps", async () => {
      mockUserModel.findOne.mockResolvedValue(mockAIBot);
      mockUserModel.findById.mockResolvedValue(mockUser);

      const mockMessage = { save: jest.fn().mockResolvedValue(true) };
      mockMessageModel.mockImplementation(() => mockMessage);

      await sendWelcomeMessage(mockUser._id);

      const messageCall = mockMessageModel.mock.calls[0][0];
      const welcomeMessage = messageCall.content;

      // Should provide actionable guidance (matches new tour-focused welcome)
      expect(welcomeMessage).toContain("Users tab");
      expect(welcomeMessage).toContain("friend request");
      expect(welcomeMessage).toContain("Ask me anything");
    });
  });
});
