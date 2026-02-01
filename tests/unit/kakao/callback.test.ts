/**
 * Kakao Callback Handler Tests
 *
 * Tests for callback tracking and sending responses via callback URL.
 * Kakao callbacks are single-use and expire after 1 minute.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendCallback,
  isCallbackExpired,
  createCallbackTracker,
  type PendingCallback,
} from "../../../src/kakao/callback";
import type { KakaoSkillResponse } from "../../../src/types";

describe("Kakao Callback Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("sendCallback", () => {
    it("should POST response to callback URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const callbackUrl = "https://example.com/callback";
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: { text: "Hello from callback" },
            },
          ],
        },
      };

      const result = await sendCallback(callbackUrl, response);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
    });

    it("should return error on failed POST", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      const callbackUrl = "https://example.com/callback";
      const response: KakaoSkillResponse = {
        version: "2.0",
        useCallback: true,
      };

      const result = await sendCallback(callbackUrl, response);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle network errors gracefully", async () => {
      const mockFetch = vi.fn().mockRejectedValue(
        new Error("Network error")
      );
      global.fetch = mockFetch;

      const callbackUrl = "https://example.com/callback";
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Test" } }],
        },
      };

      const result = await sendCallback(callbackUrl, response);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should handle timeout errors", async () => {
      const mockFetch = vi.fn().mockRejectedValue(
        new Error("Request timeout")
      );
      global.fetch = mockFetch;

      const callbackUrl = "https://example.com/callback";
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Test" } }],
        },
      };

      const result = await sendCallback(callbackUrl, response);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should send valid JSON body", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const callbackUrl = "https://example.com/callback";
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [
            {
              simpleText: { text: "Korean: 안녕하세요" },
            },
          ],
        },
      };

      await sendCallback(callbackUrl, response);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.version).toBe("2.0");
      expect(body.template.outputs[0].simpleText.text).toBe(
        "Korean: 안녕하세요"
      );
    });
  });

  describe("isCallbackExpired", () => {
    it("should return false for callback within 1 minute", () => {
      const now = Date.now();
      const callback: PendingCallback = {
        callbackUrl: "https://example.com/callback",
        expiresAt: now + 30000, // 30 seconds from now
        messageId: "msg123",
      };

      expect(isCallbackExpired(callback)).toBe(false);
    });

    it("should return true for expired callback", () => {
      const now = Date.now();
      const callback: PendingCallback = {
        callbackUrl: "https://example.com/callback",
        expiresAt: now - 1000, // 1 second ago
        messageId: "msg123",
      };

      expect(isCallbackExpired(callback)).toBe(true);
    });

    it("should return true at exact expiration time", () => {
      const now = Date.now();
      const callback: PendingCallback = {
        callbackUrl: "https://example.com/callback",
        expiresAt: now,
        messageId: "msg123",
      };

      expect(isCallbackExpired(callback)).toBe(true);
    });

    it("should handle callbacks expiring in 1 minute (60000ms)", () => {
      const now = Date.now();
      const callback: PendingCallback = {
        callbackUrl: "https://example.com/callback",
        expiresAt: now + 60000,
        messageId: "msg123",
      };

      expect(isCallbackExpired(callback)).toBe(false);
    });
  });

  describe("createCallbackTracker", () => {
    it("should add and retrieve callback", () => {
      const tracker = createCallbackTracker();
      const callback: PendingCallback = {
        callbackUrl: "https://example.com/callback",
        expiresAt: Date.now() + 60000,
        messageId: "msg123",
      };

      tracker.add(callback);
      const retrieved = tracker.get("msg123");

      expect(retrieved).toEqual(callback);
    });

    it("should return undefined for non-existent callback", () => {
      const tracker = createCallbackTracker();

      const retrieved = tracker.get("nonexistent");

      expect(retrieved).toBeUndefined();
    });

    it("should remove callback", () => {
      const tracker = createCallbackTracker();
      const callback: PendingCallback = {
        callbackUrl: "https://example.com/callback",
        expiresAt: Date.now() + 60000,
        messageId: "msg123",
      };

      tracker.add(callback);
      tracker.remove("msg123");
      const retrieved = tracker.get("msg123");

      expect(retrieved).toBeUndefined();
    });

    it("should handle multiple callbacks", () => {
      const tracker = createCallbackTracker();
      const callback1: PendingCallback = {
        callbackUrl: "https://example.com/callback1",
        expiresAt: Date.now() + 60000,
        messageId: "msg1",
      };
      const callback2: PendingCallback = {
        callbackUrl: "https://example.com/callback2",
        expiresAt: Date.now() + 60000,
        messageId: "msg2",
      };

      tracker.add(callback1);
      tracker.add(callback2);

      expect(tracker.get("msg1")).toEqual(callback1);
      expect(tracker.get("msg2")).toEqual(callback2);
    });

    it("should cleanup expired callbacks", () => {
      const tracker = createCallbackTracker();
      const now = Date.now();

      const expiredCallback: PendingCallback = {
        callbackUrl: "https://example.com/callback1",
        expiresAt: now - 1000, // Expired
        messageId: "msg1",
      };
      const validCallback: PendingCallback = {
        callbackUrl: "https://example.com/callback2",
        expiresAt: now + 60000, // Valid
        messageId: "msg2",
      };

      tracker.add(expiredCallback);
      tracker.add(validCallback);
      tracker.cleanup();

      expect(tracker.get("msg1")).toBeUndefined();
      expect(tracker.get("msg2")).toEqual(validCallback);
    });

    it("should allow overwriting existing callback", () => {
      const tracker = createCallbackTracker();
      const callback1: PendingCallback = {
        callbackUrl: "https://example.com/callback1",
        expiresAt: Date.now() + 60000,
        messageId: "msg123",
      };
      const callback2: PendingCallback = {
        callbackUrl: "https://example.com/callback2",
        expiresAt: Date.now() + 60000,
        messageId: "msg123",
      };

      tracker.add(callback1);
      tracker.add(callback2);
      const retrieved = tracker.get("msg123");

      expect(retrieved).toEqual(callback2);
    });

    it("should handle remove on non-existent callback", () => {
      const tracker = createCallbackTracker();

      expect(() => {
        tracker.remove("nonexistent");
      }).not.toThrow();
    });
  });

  describe("Callback integration scenarios", () => {
    it("should track callback and send response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const tracker = createCallbackTracker();
      const callbackUrl = "https://example.com/callback";
      const messageId = "msg123";

      const callback: PendingCallback = {
        callbackUrl,
        expiresAt: Date.now() + 60000,
        messageId,
      };

      tracker.add(callback);
      const retrieved = tracker.get(messageId);

      expect(retrieved).toBeDefined();

      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Response" } }],
        },
      };

      const result = await sendCallback(retrieved!.callbackUrl, response);

      expect(result.success).toBe(true);
      tracker.remove(messageId);
      expect(tracker.get(messageId)).toBeUndefined();
    });

    it("should not send callback if expired", () => {
      const tracker = createCallbackTracker();
      const now = Date.now();

      const callback: PendingCallback = {
        callbackUrl: "https://example.com/callback",
        expiresAt: now - 1000,
        messageId: "msg123",
      };

      tracker.add(callback);
      const retrieved = tracker.get("msg123");

      expect(isCallbackExpired(retrieved!)).toBe(true);
    });
  });
});
