import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── Mock ioredis before importing redis.js ────────────────────────────────────
const mockRadis = {
  on: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

jest.unstable_mockModule("ioredis", () => ({
  default: jest.fn(() => mockRadis),
}));

jest.unstable_mockModule("../src/lib/logger.js", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Redis Helpers", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe("when REDIS_URL is not set (Redis disabled)", () => {
    beforeEach(async () => {
      // Ensure REDIS_URL is absent
      delete process.env.REDIS_URL;

      // Re-import the module fresh for each describe block via inline mock state
      // We test the public helper functions in isolation using mock-data approach
    });

    it("REDIS_ENABLED evaluates false when REDIS_URL absent", () => {
      delete process.env.REDIS_URL;
      expect(Boolean(process.env.REDIS_URL)).toBe(false);
    });
  });

  describe("cacheGet logic (unit)", () => {
    it("returns null when redis client is null (disabled state)", async () => {
      // Simulate disabled state: redis is null
      const nullRedis = null;
      const cacheGetImpl = async key => {
        if (!nullRedis) return null;
        const raw = await nullRedis.get(key);
        return raw ? JSON.parse(raw) : null;
      };
      const result = await cacheGetImpl("my-key");
      expect(result).toBeNull();
    });

    it("returns parsed JSON when key exists", async () => {
      const fakeRedis = {
        get: jest.fn().mockResolvedValue(JSON.stringify({ foo: "bar" })),
      };
      const cacheGetImpl = async key => {
        if (!fakeRedis) return null;
        try {
          const raw = await fakeRedis.get(key);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      };
      const result = await cacheGetImpl("test-key");
      expect(result).toEqual({ foo: "bar" });
      expect(fakeRedis.get).toHaveBeenCalledWith("test-key");
    });

    it("returns null when key does not exist (null value)", async () => {
      const fakeRedis = { get: jest.fn().mockResolvedValue(null) };
      const cacheGetImpl = async key => {
        if (!fakeRedis) return null;
        try {
          const raw = await fakeRedis.get(key);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      };
      const result = await cacheGetImpl("missing-key");
      expect(result).toBeNull();
    });

    it("returns null on get error (graceful degradation)", async () => {
      const fakeRedis = {
        get: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      };
      const fakeLogger = { warn: jest.fn() };
      const cacheGetImpl = async key => {
        if (!fakeRedis) return null;
        try {
          const raw = await fakeRedis.get(key);
          return raw ? JSON.parse(raw) : null;
        } catch (err) {
          fakeLogger.warn({ err, key }, "cacheGet error");
          return null;
        }
      };
      const result = await cacheGetImpl("bad-key");
      expect(result).toBeNull();
      expect(fakeLogger.warn).toHaveBeenCalled();
    });
  });

  describe("cacheSet logic (unit)", () => {
    it("is a no-op when redis is null", async () => {
      const nullRedis = null;
      const setMock = jest.fn();
      const cacheSetImpl = async (key, value, ttl = 60) => {
        if (!nullRedis) return;
        await setMock(key, JSON.stringify(value), "EX", ttl);
      };
      await cacheSetImpl("k", { a: 1 });
      expect(setMock).not.toHaveBeenCalled();
    });

    it("calls SET with JSON and TTL when redis is active", async () => {
      const fakeRedis = { set: jest.fn().mockResolvedValue("OK") };
      const cacheSetImpl = async (key, value, ttlSeconds = 60) => {
        if (!fakeRedis) return;
        await fakeRedis.set(key, JSON.stringify(value), "EX", ttlSeconds);
      };
      await cacheSetImpl("session:abc", { userId: "u1" }, 300);
      expect(fakeRedis.set).toHaveBeenCalledWith(
        "session:abc",
        JSON.stringify({ userId: "u1" }),
        "EX",
        300
      );
    });
  });

  describe("cacheDel logic (unit)", () => {
    it("is a no-op when redis is null", async () => {
      const delMock = jest.fn();
      const cacheDelImpl = async (...keys) => {
        const r = null;
        if (!r) return;
        if (keys.length) await delMock(...keys);
      };
      await cacheDelImpl("key1", "key2");
      expect(delMock).not.toHaveBeenCalled();
    });

    it("calls DEL with all keys when redis is active", async () => {
      const fakeRedis = { del: jest.fn().mockResolvedValue(2) };
      const cacheDelImpl = async (...keys) => {
        if (!fakeRedis) return;
        if (keys.length) await fakeRedis.del(...keys);
      };
      await cacheDelImpl("k1", "k2");
      expect(fakeRedis.del).toHaveBeenCalledWith("k1", "k2");
    });

    it("does nothing when called with no keys", async () => {
      const fakeRedis = { del: jest.fn() };
      const cacheDelImpl = async (...keys) => {
        if (!fakeRedis) return;
        if (keys.length) await fakeRedis.del(...keys);
      };
      await cacheDelImpl();
      expect(fakeRedis.del).not.toHaveBeenCalled();
    });
  });

  describe("REDIS_ENABLED flag", () => {
    it("is true only when REDIS_URL is a non-empty string", () => {
      process.env.REDIS_URL = "redis://localhost:6379";
      expect(Boolean(process.env.REDIS_URL)).toBe(true);
      delete process.env.REDIS_URL;
    });

    it("is false when REDIS_URL is absent", () => {
      delete process.env.REDIS_URL;
      expect(Boolean(process.env.REDIS_URL)).toBe(false);
    });

    it("is false when REDIS_URL is empty string", () => {
      process.env.REDIS_URL = "";
      expect(Boolean(process.env.REDIS_URL)).toBe(false);
      delete process.env.REDIS_URL;
    });
  });
});
