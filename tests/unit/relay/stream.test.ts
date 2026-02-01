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

// Mock the session module
vi.mock("../../../src/relay/session.js", () => ({
  createSession: vi.fn(),
  DEFAULT_RELAY_URL: "https://k.tess.dev/",
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

    it("should use default relayUrl when not specified", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");
      const { createSession } = await import("../../../src/relay/session.js");

      // Mock createSession to return success
      vi.mocked(createSession).mockResolvedValue({
        ok: true,
        data: {
          sessionToken: "test_session_token",
          pairingCode: "ABCD-1234",
          expiresIn: 300,
          status: "pending_pairing",
        },
      });

      const mockAccount: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        mode: "relay",
        config: {
          enabled: true,
          mode: "relay",
          dmPolicy: "open",
        },
      };

      const controller = new AbortController();
      const mockOnMessage = vi.fn();
      const mockOnPairingRequired = vi.fn();

      // Start the stream (will abort immediately)
      controller.abort();

      try {
        await startRelayStream(
          mockAccount,
          mockOnMessage,
          controller.signal,
          {},
          { onPairingRequired: mockOnPairingRequired }
        );
      } catch {
        // Expected to throw due to abort
      }

      // Verify createSession was called with default URL
      expect(createSession).toHaveBeenCalledWith("https://k.tess.dev/");
    });

    it("should call onPairingRequired callback when creating new session", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");
      const { createSession } = await import("../../../src/relay/session.js");

      vi.mocked(createSession).mockResolvedValue({
        ok: true,
        data: {
          sessionToken: "test_session_token",
          pairingCode: "ABCD-1234",
          expiresIn: 300,
          status: "pending_pairing",
        },
      });

      const mockAccount: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        mode: "relay",
        config: {
          enabled: true,
          mode: "relay",
          dmPolicy: "open",
        },
      };

      const controller = new AbortController();
      const mockOnMessage = vi.fn();
      const mockOnPairingRequired = vi.fn();

      controller.abort();

      try {
        await startRelayStream(
          mockAccount,
          mockOnMessage,
          controller.signal,
          {},
          { onPairingRequired: mockOnPairingRequired }
        );
      } catch {
        // Expected
      }

      expect(mockOnPairingRequired).toHaveBeenCalledWith("ABCD-1234", 300);
    });

    it("should use sessionToken from config if available", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");
      const { createSession } = await import("../../../src/relay/session.js");

      const mockAccount: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        mode: "relay",
        config: {
          enabled: true,
          mode: "relay",
          sessionToken: "existing_session_token",
          dmPolicy: "open",
        },
      };

      const controller = new AbortController();
      const mockOnMessage = vi.fn();

      controller.abort();

      try {
        await startRelayStream(mockAccount, mockOnMessage, controller.signal);
      } catch {
        // Expected
      }

      // Should not call createSession when sessionToken exists
      expect(createSession).not.toHaveBeenCalled();
    });

    it("should use relayToken from config if available", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");
      const { createSession } = await import("../../../src/relay/session.js");

      const mockAccount: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        mode: "relay",
        config: {
          enabled: true,
          mode: "relay",
          relayToken: "config_relay_token",
          dmPolicy: "open",
        },
      };

      const controller = new AbortController();
      const mockOnMessage = vi.fn();

      controller.abort();

      try {
        await startRelayStream(mockAccount, mockOnMessage, controller.signal);
      } catch {
        // Expected
      }

      // Should not call createSession when relayToken exists
      expect(createSession).not.toHaveBeenCalled();
    });

    it("should throw error when session creation fails", async () => {
      const { startRelayStream } = await import("../../../src/relay/stream.js");
      const { createSession } = await import("../../../src/relay/session.js");

      vi.mocked(createSession).mockResolvedValue({
        ok: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Connection refused",
        },
      });

      const mockAccount: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        mode: "relay",
        config: {
          enabled: true,
          mode: "relay",
          dmPolicy: "open",
        },
      };

      const controller = new AbortController();
      const mockOnMessage = vi.fn();

      await expect(
        startRelayStream(mockAccount, mockOnMessage, controller.signal)
      ).rejects.toThrow("Failed to create session: Connection refused");
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
