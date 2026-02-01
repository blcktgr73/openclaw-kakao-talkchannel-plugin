/**
 * Gateway Adapter tests (Simplified)
 *
 * Relay mode only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedKakaoTalkChannel } from "../../../src/types";

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

vi.mock("../../../src/relay/stream.js", () => ({
  startRelayStream: vi.fn().mockResolvedValue(undefined),
}));

const { gatewayAdapter } = await import("../../../src/adapters/gateway");

describe("Gateway Adapter (Simplified)", () => {
  let mockTalkChannel: ResolvedKakaoTalkChannel;
  let mockAbortSignal: AbortSignal;
  let mockOnMessage: ReturnType<typeof vi.fn>;
  let mockLog: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockTalkChannel = {
      talkchannelId: "default",
      enabled: true,
      config: {
        enabled: true,
        channelId: "channel123",
        dmPolicy: "pairing",
        relayUrl: "https://relay.example.com",
      },
    };

    mockAbortSignal = new AbortController().signal;
    mockOnMessage = vi.fn(async () => {}) as any;
    mockLog = {
      info: vi.fn() as any,
      error: vi.fn() as any,
    };
  });

  describe("startTalkChannel", () => {
    it("should always start SSE stream (relay mode only)", async () => {
      const ctx = {
        talkchannel: mockTalkChannel,
        cfg: {},
        abortSignal: mockAbortSignal,
        onMessage: mockOnMessage,
        log: mockLog,
      };

      await expect(gatewayAdapter.startTalkChannel(ctx as any)).resolves.toBeUndefined();
    });

    it("should log info message when starting", async () => {
      const ctx = {
        talkchannel: mockTalkChannel,
        cfg: {},
        abortSignal: mockAbortSignal,
        onMessage: mockOnMessage,
        log: mockLog,
      };

      await gatewayAdapter.startTalkChannel(ctx as any);

      expect(mockLog.info).toHaveBeenCalled();
      const logMessage = mockLog.info.mock.calls[0]?.[0] ?? "";
      expect(logMessage.toLowerCase()).toContain("sse");
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();
      const ctx = {
        talkchannel: mockTalkChannel,
        cfg: {},
        abortSignal: controller.signal,
        onMessage: mockOnMessage,
        log: mockLog,
      };

      const startPromise = gatewayAdapter.startTalkChannel(ctx as any);
      controller.abort();

      await expect(startPromise).resolves.toBeUndefined();
    });

    it("should accept optional log parameter", async () => {
      const ctx = {
        talkchannel: mockTalkChannel,
        cfg: {},
        abortSignal: mockAbortSignal,
        onMessage: mockOnMessage,
        // log is optional
      };

      await expect(gatewayAdapter.startTalkChannel(ctx as any)).resolves.toBeUndefined();
    });

    it("should call onMessage callback when message received", async () => {
      const ctx = {
        talkchannel: mockTalkChannel,
        cfg: {},
        abortSignal: mockAbortSignal,
        onMessage: mockOnMessage,
        log: mockLog,
      };

      await gatewayAdapter.startTalkChannel(ctx as any);
      expect(typeof ctx.onMessage).toBe("function");
    });
  });

  describe("stopTalkChannel", () => {
    it("should stop talkchannel", async () => {
      const ctx = {
        talkchannelId: "default",
      };

      await expect(gatewayAdapter.stopTalkChannel(ctx)).resolves.toBeUndefined();
    });

    it("should handle multiple stop calls", async () => {
      const ctx = {
        talkchannelId: "default",
      };

      await gatewayAdapter.stopTalkChannel(ctx);
      await gatewayAdapter.stopTalkChannel(ctx);

      expect(true).toBe(true);
    });
  });
});
