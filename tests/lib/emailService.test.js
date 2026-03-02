import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Mock nodemailer first
const mockSendMail = jest.fn();
const mockCreateTransporter = jest.fn(() => ({
  sendMail: mockSendMail,
}));

jest.unstable_mockModule("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransporter,
  },
}));

// Import after mocking
const { sendWelcomeEmail } = await import("../../src/lib/emailService.js");

// Mock environment variables
const originalEnv = process.env;

describe("Email Service - Welcome Email", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup environment variables
    process.env = {
      ...originalEnv,
      SMTP_HOST: "smtp.test.com",
      SMTP_USER: "test@test.com",
      SMTP_PASS: "testpass",
      SMTP_FROM: "Chatter <noreply@chatter.dev>",
      FRONTEND_URL: "http://localhost:5173",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("sendWelcomeEmail", () => {
    const mockUser = {
      _id: "507f1f77bcf86cd799439011",
      name: "testuser",
      fullName: "Test User",
      email: "test@example.com",
    };

    it("should send welcome email with correct content for valid user", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-id" });

      const result = await sendWelcomeEmail(mockUser);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.to).toBe(mockUser.email);
      expect(emailCall.subject).toContain("Welcome to Chatter");
      expect(emailCall.html).toContain(mockUser.fullName);
      expect(emailCall.html).toContain("Sachin Kumar");
      expect(emailCall.html).toContain("Google Gemini");
      expect(emailCall.html).toContain("sachin@chatter.dev");
    });

    it("should handle user with only name (no fullName)", async () => {
      const userWithoutFullName = {
        ...mockUser,
        fullName: undefined,
      };

      mockSendMail.mockResolvedValue({ messageId: "test-id" });

      const result = await sendWelcomeEmail(userWithoutFullName);

      expect(result).toBe(true);
      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain(userWithoutFullName.name);
    });

    it("should return false when email configuration is missing", async () => {
      delete process.env.SMTP_HOST;

      const result = await sendWelcomeEmail(mockUser);

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should return false when user email is missing", async () => {
      const userWithoutEmail = {
        ...mockUser,
        email: undefined,
      };

      const result = await sendWelcomeEmail(userWithoutEmail);

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should return false when email sending fails", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP Error"));

      const result = await sendWelcomeEmail(mockUser);

      expect(result).toBe(false);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });

    it("should include all required welcome email components", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-id" });

      await sendWelcomeEmail(mockUser);

      const emailCall = mockSendMail.mock.calls[0][0];
      const emailHtml = emailCall.html;

      // Check for key sections
      expect(emailHtml).toContain("Welcome to Chatter");
      expect(emailHtml).toContain("AI-Powered ChatterBot");
      expect(emailHtml).toContain("Smart Notifications");
      expect(emailHtml).toContain("Real-time Messaging");
      expect(emailHtml).toContain("Built with Modern Technology");
      expect(emailHtml).toContain("React 19");
      expect(emailHtml).toContain("TypeScript");
      expect(emailHtml).toContain("Node.js");
      expect(emailHtml).toContain("MongoDB");
      expect(emailHtml).toContain("Socket.IO");
      expect(emailHtml).toContain("Google Gemini");
      expect(emailHtml).toContain("Tailwind CSS");
      expect(emailHtml).toContain("About the Developer");
      expect(emailHtml).toContain("Sachin Kumar");
      expect(emailHtml).toContain("full-stack developer");
      expect(emailHtml).toContain("Help & Guide");
      expect(emailHtml).toContain("sachin@chatter.dev");
      expect(emailHtml).toContain("Start Chatting");
      expect(emailHtml).toContain("Launch Chatter Now");
    });

    it("should include correct links in welcome email", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-id" });

      await sendWelcomeEmail(mockUser);

      const emailCall = mockSendMail.mock.calls[0][0];
      const emailHtml = emailCall.html;

      expect(emailHtml).toContain("http://localhost:5173");
      expect(emailHtml).toContain("http://localhost:5173/help");
      expect(emailHtml).toContain("http://localhost:5173/support");
      expect(emailHtml).toContain("mailto:sachin@chatter.dev");
    });

    it("should return true when email is sent successfully", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-id" });

      const result = await sendWelcomeEmail(mockUser);

      expect(result).toBe(true);
    });

    it("should return false when email sending fails", async () => {
      const error = new Error("SMTP Connection Failed");
      mockSendMail.mockRejectedValue(error);

      const result = await sendWelcomeEmail(mockUser);

      expect(result).toBe(false);
    });

    it("should handle different environment configurations", async () => {
      process.env.FRONTEND_URL = "https://chatter.dev";
      mockSendMail.mockResolvedValue({ messageId: "test-id" });

      await sendWelcomeEmail(mockUser);

      const emailCall = mockSendMail.mock.calls[0][0];
      expect(emailCall.html).toContain("https://chatter.dev");
      expect(emailCall.html).toContain("https://chatter.dev/help");
    });
  });

  describe("Email Content Validation", () => {
    it("should contain professional greeting", async () => {
      const mockUser = {
        _id: "507f1f77bcf86cd799439011",
        name: "professional",
        fullName: "Professional User",
        email: "pro@company.com",
      };

      mockSendMail.mockResolvedValue({ messageId: "test-id" });
      await sendWelcomeEmail(mockUser);

      const emailHtml = mockSendMail.mock.calls[0][0].html;
      expect(emailHtml).toContain("Welcome to Chatter, Professional User!");
      expect(emailHtml).toContain("Your Chatter account is ready");
    });

    it("should showcase technical excellence", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-id" });
      await sendWelcomeEmail({
        _id: "507f1f77bcf86cd799439011",
        name: "techuser",
        fullName: "Tech User",
        email: "tech@example.com",
      });

      const emailHtml = mockSendMail.mock.calls[0][0].html;

      // Should highlight technical achievements
      expect(emailHtml).toContain("cutting-edge technology");
      expect(emailHtml).toContain("modern web development practices");
      expect(emailHtml).toContain("AI integration");
      expect(emailHtml).toContain("user-centric design");
    });

    it("should present developer credentials professionally", async () => {
      mockSendMail.mockResolvedValue({ messageId: "test-id" });
      await sendWelcomeEmail({
        _id: "507f1f77bcf86cd799439011",
        name: "recruiter",
        fullName: "Recruiter User",
        email: "recruiter@company.com",
      });

      const emailHtml = mockSendMail.mock.calls[0][0].html;

      // Should showcase skills professionally
      expect(emailHtml).toContain("passionate full-stack developer");
      expect(emailHtml).toContain("meaningful digital experiences");
      expect(emailHtml).toContain("modern web development practices");
      expect(emailHtml).toContain("Sachin Kumar");
      expect(emailHtml).toContain("About the Developer");
      expect(emailHtml).toContain("AI integration");
    });
  });
});

// Performance tests
describe("Email Service Performance", () => {
  it("should send email within acceptable time limit", async () => {
    const startTime = Date.now();
    mockSendMail.mockResolvedValue({ messageId: "test-id" });

    await sendWelcomeEmail({
      _id: "507f1f77bcf86cd799439011",
      name: "testuser",
      fullName: "Test User",
      email: "test@example.com",
    });

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
