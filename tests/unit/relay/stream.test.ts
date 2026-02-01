import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedKakaoAccount } from "../../../src/types";

vi.mock("../../../src/runtime.js", () => ({
  getKakaoRuntime: () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }),
}));

describe("Relay Stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startRelayStream", () => {
    it("should export startRelayStream function", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");
      expect(typeof startRelayStream).toBe("function");
    });

    it("should throw error when relayUrl is missing", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");

      const mockAccount: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        channelId: "ch1",
        mode: "relay",
        config: {
          enabled: true,
          channelId: "ch1",
          mode: "relay",
          relayToken: "token",
          dmPolicy: "open",
        },
      };

      const controller = new AbortController();
      const mockOnMessage = vi.fn();

      await expect(
        startRelayStream(mockAccount, mockOnMessage, controller.signal)
      ).rejects.toThrow("relayUrl and relayToken");
    });

    it("should throw error when relayToken is missing", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");

      const mockAccount: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        channelId: "ch1",
        mode: "relay",
        config: {
          enabled: true,
          channelId: "ch1",
          mode: "relay",
          relayUrl: "https://relay.example.com",
          dmPolicy: "open",
        },
      };

      const controller = new AbortController();
      const mockOnMessage = vi.fn();

      await expect(
        startRelayStream(mockAccount, mockOnMessage, controller.signal)
      ).rejects.toThrow("relayUrl and relayToken");
    });
  });

  describe("exports", () => {
    it("should re-export SSE functions", async () => {
      const stream = await import("../../../src/relay/stream.js");

      expect(typeof stream.connectSSE).toBe("function");
      expect(typeof stream.parseSSEChunk).toBe("function");
      expect(typeof stream.calculateReconnectDelay).toBe("function");
    });
  });
});
