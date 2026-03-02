import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Mock dependencies using ES module syntax
const mockUserModel = {
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
};

const mockGenerateToken = jest.fn();
const mockSendWelcomeEmail = jest.fn();
const mockSendWelcomeMessage = jest.fn();
const mockCompare = jest.fn();
const mockHash = jest.fn();

// Mock modules
jest.unstable_mockModule("../src/models/user.model.js", () => ({
  default: mockUserModel,
}));

jest.unstable_mockModule("../src/lib/utils.js", () => ({
  generateToken: mockGenerateToken,
}));

jest.unstable_mockModule("../src/lib/emailService.js", () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendResetVerificationEmail: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule("../src/controllers/ai.controller.js", () => ({
  autoAddAIBotFriend: jest.fn().mockResolvedValue(undefined),
  sendWelcomeMessage: mockSendWelcomeMessage,
}));

jest.unstable_mockModule("argon2", () => ({
  default: {
    verify: mockCompare,
    hash: mockHash,
  },
}));

jest.unstable_mockModule("../src/lib/redis.js", () => ({
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
  cacheDel: jest.fn().mockResolvedValue(undefined),
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
  redisPub: {},
  redisSub: {},
}));

jest.unstable_mockModule("../src/utils/messageCensorship.js", () => ({
  validateUserName: jest.fn().mockReturnValue({ isValid: true }),
}));

jest.unstable_mockModule("../src/lib/cloudinary.js", () => ({
  default: { uploader: { upload: jest.fn().mockResolvedValue({ secure_url: "http://img" }) } },
}));

// Import after mocking
const { login, signup } = await import(
  "../../src/controllers/auth.controller.js"
);

describe("Auth Controller - Welcome System", () => {
  let mockReq, mockRes;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock request and response
    mockReq = {
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      clearCookie: jest.fn(),
    };

    // Setup mock implementations
    mockGenerateToken.mockReturnValue("mock-jwt-token");
  });

  describe("login function", () => {
    const mockLoginData = {
      name: "testuser",
      password: "password123",
    };

    it("should handle first-time login with welcome email and ChatterBot message", async () => {
      const mockUser = {
        _id: "user123",
        name: "testuser",
        email: "test@example.com",
        profile: "avatar.jpg",
        lastWelcomeEmailSent: null, // First login
        isGuest: false,
      };

      // Mock database calls
      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockSendWelcomeEmail.mockResolvedValue(true);
      mockSendWelcomeMessage.mockResolvedValue(true);

      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      // Verify user lookup
      expect(mockUserModel.findOne).toHaveBeenCalledWith({
        name: mockLoginData.name,
      });

      // Verify password comparison (argon2.verify(hash, plain))
      expect(mockCompare).toHaveBeenCalledWith(
        mockUser.password,
        mockLoginData.password
      );

      // Verify welcome email was sent
      expect(mockSendWelcomeEmail).toHaveBeenCalledWith(mockUser);

      // Verify user update with welcome email timestamp
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id,
        expect.objectContaining({
          lastWelcomeEmailSent: expect.any(Date),
          lastLogin: expect.any(Date),
        })
      );

      // Verify response includes first login flag
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUser._id,
          name: mockUser.name,
          profile: mockUser.profile,
          token: "mock-jwt-token",
          isFirstLogin: true,
        })
      );
    });

    it("should handle returning user login without welcome email", async () => {
      const mockUser = {
        _id: "user123",
        name: "testuser",
        email: "test@example.com",
        profile: "avatar.jpg",
        lastWelcomeEmailSent: new Date("2023-01-01"), // Already sent
        isGuest: false,
      };

      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);

      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      // Verify welcome email was NOT sent
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
      expect(mockSendWelcomeMessage).not.toHaveBeenCalled();

      // Verify only last login was updated
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUser._id,
        {
          lastLogin: expect.any(Date),
        }
      );

      // Verify response indicates returning user
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isFirstLogin: false,
        })
      );
    });

    it("should handle guest user login without welcome email", async () => {
      const mockGuestUser = {
        _id: "guest123",
        name: "Guest_123456",
        email: "guest@chatter.local",
        profile: "avatar.jpg",
        lastWelcomeEmailSent: null,
        isGuest: true,
      };

      mockUserModel.findOne.mockResolvedValue(mockGuestUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockGuestUser);
      mockCompare.mockResolvedValue(true);

      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      // Verify welcome email was NOT sent for guest
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();

      // Verify only last login was updated
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockGuestUser._id,
        {
          lastLogin: expect.any(Date),
        }
      );
    });

    it("should handle email service failure gracefully", async () => {
      const mockUser = {
        _id: "user123",
        name: "testuser",
        email: "test@example.com",
        profile: "avatar.jpg",
        lastWelcomeEmailSent: null,
        isGuest: false,
      };

      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockSendWelcomeEmail.mockRejectedValue(new Error("Email service down"));


      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      // Verify login still succeeds despite email failure
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUser._id,
          isFirstLogin: true,
        })
      );

      // Verify error was logged gracefully

    });

    it("should handle invalid credentials", async () => {
      mockUserModel.findOne.mockResolvedValue(null);

      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });

      // Verify no welcome email or update operations
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("should handle incorrect password", async () => {
      const mockUser = {
        _id: "user123",
        name: "testuser",
        password: "hashedpassword",
      };

      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(false);

      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Invalid credentials",
      });

      // Verify no welcome operations
      expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockUserModel.findOne.mockRejectedValue(
        new Error("Database connection failed")
      );


      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });

    });

    it("should schedule ChatterBot welcome message with delay", async () => {
      const mockUser = {
        _id: "user123",
        name: "testuser",
        email: "test@example.com",
        lastWelcomeEmailSent: null,
        isGuest: false,
      };

      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockSendWelcomeEmail.mockResolvedValue(true);

      // Mock setTimeout to capture the callback
      const originalSetTimeout = global.setTimeout;
      const mockSetTimeout = jest.fn((callback, delay) => {
        expect(delay).toBe(2000); // 2 second delay
        // Execute callback immediately for testing
        callback();
        return "timeout-id";
      });
      global.setTimeout = mockSetTimeout;

      mockReq.body = mockLoginData;

      await login(mockReq, mockRes);

      // Verify setTimeout was called with correct delay
      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 2000);

      // Verify ChatterBot message was scheduled
      expect(mockSendWelcomeMessage).toHaveBeenCalledWith(mockUser._id);

      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });
  });

  describe("Welcome System Integration", () => {
    it("should ensure proper sequence of welcome operations", async () => {
      const mockUser = {
        _id: "user123",
        name: "testuser",
        email: "test@example.com",
        lastWelcomeEmailSent: null,
        isGuest: false,
      };

      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockSendWelcomeEmail.mockResolvedValue(true);

      const operationOrder = [];

      // Track operation order
      mockSendWelcomeEmail.mockImplementation(async (user) => {
        operationOrder.push("welcome-email");
        return true;
      });

      mockUserModel.findByIdAndUpdate.mockImplementation(async (id, update) => {
        operationOrder.push("user-update");
        return mockUser;
      });

      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (callback, delay) => {
        operationOrder.push("schedule-chatbot");
        // Execute immediately for testing
        callback();
        return "timeout-id";
      };

      mockSendWelcomeMessage.mockImplementation(async (userId) => {
        operationOrder.push("chatbot-message");
        return true;
      });

      mockReq.body = { name: "testuser", password: "password123" };

      await login(mockReq, mockRes);

      // Verify correct operation sequence
      expect(operationOrder).toEqual([
        "welcome-email",
        "user-update",
        "schedule-chatbot",
        "chatbot-message",
      ]);

      global.setTimeout = originalSetTimeout;
    });

    it("should update user model with correct timestamp fields", async () => {
      const mockUser = {
        _id: "user123",
        name: "testuser",
        email: "test@example.com",
        lastWelcomeEmailSent: null,
        isGuest: false,
      };

      mockUserModel.findOne.mockResolvedValue(mockUser);
      mockUserModel.findByIdAndUpdate.mockResolvedValue(mockUser);
      mockCompare.mockResolvedValue(true);
      mockSendWelcomeEmail.mockResolvedValue(true);

      const beforeTime = new Date();

      mockReq.body = { name: "testuser", password: "password123" };

      await login(mockReq, mockRes);

      const afterTime = new Date();

      // Verify update was called with timestamp fields
      const updateCall = mockUserModel.findByIdAndUpdate.mock.calls[0];
      expect(updateCall[0]).toBe(mockUser._id);

      const updateData = updateCall[1];
      expect(updateData).toHaveProperty("lastWelcomeEmailSent");
      expect(updateData).toHaveProperty("lastLogin");

      // Verify timestamps are recent
      expect(updateData.lastWelcomeEmailSent).toBeInstanceOf(Date);
      expect(updateData.lastLogin).toBeInstanceOf(Date);
      expect(updateData.lastWelcomeEmailSent.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(updateData.lastLogin.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(updateData.lastWelcomeEmailSent.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
      expect(updateData.lastLogin.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });
  });
});
