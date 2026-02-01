import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  RelayClientConfig,
  KakaoSkillResponse,
} from "../../../src/types";
import {
  sendReply,
  healthCheck,
} from "../../../src/relay/client";

global.fetch = vi.fn();

describe("Relay Client", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  const baseConfig: RelayClientConfig = {
    relayUrl: "https://relay.example.com",
    relayToken: "test-token-123",
    timeoutMs: 5000,
  };

  beforeEach(() => {
    mockFetch = vi.mocked(global.fetch);
    mockFetch.mockClear();
  });

  describe("sendReply", () => {
    it("should send reply with valid response", async () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Hello" } }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, deliveredAt: Date.now() }),
      } as Response);

      const result = await sendReply(baseConfig, "msg_123", response);

      expect(result.success).toBe(true);
      expect(result.deliveredAt).toBeDefined();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://relay.example.com/reply",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining("msg_123"),
        })
      );
    });

    it("should handle reply errors from server", async () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Hello" } }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Message not found" }),
      } as Response);

      await expect(
        sendReply(baseConfig, "msg_invalid", response)
      ).rejects.toThrow(/404.*Not Found/);
    });

    it("should handle callback response", async () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        useCallback: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, deliveredAt: Date.now() }),
      } as Response);

      const result = await sendReply(baseConfig, "msg_456", response);

      expect(result.success).toBe(true);
    });

    it("should include messageId in request body", async () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Test" } }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await sendReply(baseConfig, "msg_789", response);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1]?.body as string);
      expect(body.messageId).toBe("msg_789");
      expect(body.response).toEqual(response);
    });
  });

  describe("healthCheck", () => {
    it("should return ok status on successful health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await healthCheck(baseConfig);

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://relay.example.com/health",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token-123",
          }),
        })
      );
    });

    it("should measure latency", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await healthCheck(baseConfig);

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe("number");
    });

    it("should return error on failed health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as Response);

      const result = await healthCheck(baseConfig);

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain("503");
    });

    it("should handle network errors in health check", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await healthCheck(baseConfig);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("Connection refused");
    });
  });

  describe("Error Handling", () => {
    it("should provide descriptive error messages for HTTP errors", async () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Test" } }],
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ error: "Database connection failed" }),
      } as Response);

      await expect(sendReply(baseConfig, "msg", response)).rejects.toThrow(
        /500.*Internal Server Error/
      );
    });

    it("should handle timeout errors", async () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Test" } }],
        },
      };

      mockFetch.mockRejectedValueOnce(new Error("Request timeout"));

      await expect(sendReply(baseConfig, "msg", response)).rejects.toThrow("Request timeout");
    });
  });
});
