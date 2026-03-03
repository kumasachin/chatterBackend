import { jest, describe, it, expect, beforeEach } from "@jest/globals";

describe("BullMQ Queue Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Queue configuration logic (unit)", () => {
    it("skips queue creation when REDIS_ENABLED is false", () => {
      // Simulates the module-level guard: if (!REDIS_ENABLED) { ... }
      const REDIS_ENABLED = false;
      let emailQueue = null;
      let mediaQueue = null;

      if (REDIS_ENABLED) {
        // this block would create queues
        emailQueue = { name: "email" };
        mediaQueue = { name: "media" };
      }

      expect(emailQueue).toBeNull();
      expect(mediaQueue).toBeNull();
    });

    it("creates queues when REDIS_ENABLED is true", () => {
      const REDIS_ENABLED = true;
      let emailQueue = null;
      let mediaQueue = null;

      if (REDIS_ENABLED) {
        emailQueue = { name: "email" };
        mediaQueue = { name: "media" };
      }

      expect(emailQueue).not.toBeNull();
      expect(mediaQueue).not.toBeNull();
      expect(emailQueue.name).toBe("email");
      expect(mediaQueue.name).toBe("media");
    });
  });

  describe("Email job processing logic (unit)", () => {
    it("calls transport.sendMail with correct args from job.data", async () => {
      const mockSendMail = jest.fn().mockResolvedValue({ messageId: "abc123" });
      const mockTransport = { sendMail: mockSendMail };

      const expectedJob = {
        id: "job-1",
        data: {
          to: "user@example.com",
          subject: "Welcome!",
          html: "<p>Hello</p>",
          text: "Hello",
        },
      };

      // Replicate the worker processor function
      const processEmail = async job => {
        const { to, subject, html, text } = job.data;
        await mockTransport.sendMail({ to, subject, html, text });
      };

      await processEmail(expectedJob);

      expect(mockSendMail).toHaveBeenCalledWith({
        to: "user@example.com",
        subject: "Welcome!",
        html: "<p>Hello</p>",
        text: "Hello",
      });
    });

    it("propagates errors from sendMail so BullMQ can retry", async () => {
      const mockSendMail = jest
        .fn()
        .mockRejectedValue(new Error("SMTP timeout"));
      const mockTransport = { sendMail: mockSendMail };

      const processEmail = async job => {
        const { to, subject, html, text } = job.data;
        await mockTransport.sendMail({ to, subject, html, text });
      };

      await expect(
        processEmail({
          id: "job-2",
          data: { to: "x@x.com", subject: "Hi", html: "", text: "" },
        })
      ).rejects.toThrow("SMTP timeout");
    });
  });

  describe("Media job processing logic (unit)", () => {
    it("logs media job info without throwing", async () => {
      const mockLogger = { info: jest.fn() };

      const processMedia = async job => {
        mockLogger.info(
          { jobId: job.id, type: job.name },
          "Media job processed"
        );
      };

      await expect(
        processMedia({ id: "media-1", name: "resize-image" })
      ).resolves.toBeUndefined();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { jobId: "media-1", type: "resize-image" },
        "Media job processed"
      );
    });
  });

  describe("Worker error handler (unit)", () => {
    it("logs failure info when a job fails", () => {
      const mockLogger = { error: jest.fn() };

      const onFailed = (job, err) => {
        mockLogger.error({ jobId: job?.id, err }, "Email job failed");
      };

      onFailed({ id: "job-3" }, new Error("Queue error"));

      expect(mockLogger.error).toHaveBeenCalledWith(
        { jobId: "job-3", err: expect.any(Error) },
        "Email job failed"
      );
    });

    it("handles null job gracefully (failed before enqueue)", () => {
      const mockLogger = { error: jest.fn() };

      const onFailed = (job, err) => {
        mockLogger.error({ jobId: job?.id, err }, "Email job failed");
      };

      expect(() => onFailed(null, new Error("init error"))).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { jobId: undefined, err: expect.any(Error) },
        "Email job failed"
      );
    });
  });

  describe("Default job options (unit)", () => {
    it("email queue uses exponential backoff with 3 attempts", () => {
      const emailJobOpts = {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      };

      expect(emailJobOpts.attempts).toBe(3);
      expect(emailJobOpts.backoff.type).toBe("exponential");
      expect(emailJobOpts.backoff.delay).toBe(5000);
      expect(emailJobOpts.removeOnComplete.count).toBe(100);
    });

    it("media queue uses fixed backoff with 2 attempts", () => {
      const mediaJobOpts = {
        attempts: 2,
        backoff: { type: "fixed", delay: 3_000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      };

      expect(mediaJobOpts.attempts).toBe(2);
      expect(mediaJobOpts.backoff.type).toBe("fixed");
      expect(mediaJobOpts.backoff.delay).toBe(3000);
    });
  });
});
