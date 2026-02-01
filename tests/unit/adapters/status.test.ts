/**
 * ChannelStatusAdapter tests
 *
 * Tests for statusAdapter implementation with 8+ test cases covering:
 * - defaultRuntime: default runtime state
 * - probeAccount: health check for relay/direct modes
 * - buildAccountSnapshot: build account snapshot from account + runtime + probe
 * - collectStatusIssues: collect status issues from snapshots
 * - Edge cases: disabled accounts, relay errors, message silence
 */
import { describe, it, expect, vi } from "vitest";
import { statusAdapter } from "../../../src/adapters/status";
import type {
  ChannelAccountSnapshot,
  AccountRuntime,
} from "../../../src/adapters/status";
import type { ResolvedKakaoAccount } from "../../../src/types";

describe("ChannelStatusAdapter", () => {
  describe("defaultRuntime", () => {
    it("should provide default runtime with all null/false values", () => {
      const runtime = statusAdapter.defaultRuntime;

      expect(runtime.accountId).toBe("default");
      expect(runtime.running).toBe(false);
      expect(runtime.lastStartAt).toBeNull();
      expect(runtime.lastStopAt).toBeNull();
      expect(runtime.lastError).toBeNull();
    });

    it("should have optional lastInboundAt and lastOutboundAt as undefined", () => {
      const runtime = statusAdapter.defaultRuntime;

      expect(runtime.lastInboundAt).toBeUndefined();
      expect(runtime.lastOutboundAt).toBeUndefined();
    });
  });

  describe("probeAccount", () => {
    it("should return ok=true for direct mode accounts", async () => {
      const account: ResolvedKakaoAccount = {
        accountId: "direct-account",
        enabled: true,
        name: "Direct Channel",
        config: {
          enabled: true,
          channelId: "ch123",
          mode: "direct",
          dmPolicy: "pairing",
          publicWebhookUrl: "https://example.com/webhook",
          webhookPath: "/kakao",
        },
      };

      const result = await statusAdapter.probeAccount({ account });

      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should probe relay server for relay mode accounts", async () => {
      const account: ResolvedKakaoAccount = {
        accountId: "relay-account",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
          mode: "relay",
          dmPolicy: "open",
          relayUrl: "https://relay.example.com",
          relayToken: "token123",
        },
      };

      // Mock fetch for relay health check
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const result = await statusAdapter.probeAccount({ account });

      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe("number");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://relay.example.com/health",
        expect.objectContaining({
          method: "GET",
        })
      );
    });

    it("should return error when relay server is unreachable", async () => {
      const account: ResolvedKakaoAccount = {
        accountId: "relay-account",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
          mode: "relay",
          dmPolicy: "open",
          relayUrl: "https://relay.example.com",
          relayToken: "token123",
        },
      };

      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      const result = await statusAdapter.probeAccount({ account });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return error when relay server returns non-200 status", async () => {
      const account: ResolvedKakaoAccount = {
        accountId: "relay-account",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
          mode: "relay",
          dmPolicy: "open",
          relayUrl: "https://relay.example.com",
          relayToken: "token123",
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      const result = await statusAdapter.probeAccount({ account });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("503");
    });

    it("should return error when relay URL is not configured", async () => {
      const account: ResolvedKakaoAccount = {
        accountId: "relay-account",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
          mode: "relay",
          dmPolicy: "open",
          // relayUrl is missing
        },
      };

      const result = await statusAdapter.probeAccount({ account });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("relayUrl");
    });
  });

  describe("buildAccountSnapshot", () => {
    it("should build snapshot with all fields from account and runtime", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "acc123",
        enabled: true,
        name: "Test Channel",
        config: {
          enabled: true,
          channelId: "ch123",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const runtime: AccountRuntime = {
        accountId: "acc123",
        running: true,
        lastStartAt: "2025-01-31T10:00:00Z",
        lastStopAt: null,
        lastError: null,
        lastInboundAt: "2025-01-31T10:30:00Z",
        lastOutboundAt: "2025-01-31T10:31:00Z",
      };

      const probe = { ok: true, latencyMs: 45 };

      const snapshot = statusAdapter.buildAccountSnapshot({
        account,
        runtime,
        probe,
      });

      expect(snapshot.accountId).toBe("acc123");
      expect(snapshot.name).toBe("ch123");
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.configured).toBe(true);
      expect(snapshot.mode).toBe("direct");
      expect(snapshot.running).toBe(true);
      expect(snapshot.lastStartAt).toBe("2025-01-31T10:00:00Z");
      expect(snapshot.lastStopAt).toBeNull();
      expect(snapshot.lastError).toBeNull();
      expect(snapshot.probe).toEqual({ ok: true, latencyMs: 45 });
      expect(snapshot.lastInboundAt).toBe("2025-01-31T10:30:00Z");
      expect(snapshot.lastOutboundAt).toBe("2025-01-31T10:31:00Z");
    });

    it("should use default values when runtime is not provided", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "acc456",
        enabled: false,
        config: {
          enabled: false,
          channelId: "ch456",
          mode: "relay",
          dmPolicy: "open",
        },
      };

      const snapshot = statusAdapter.buildAccountSnapshot({ account });

      expect(snapshot.accountId).toBe("acc456");
      expect(snapshot.enabled).toBe(false);
      expect(snapshot.running).toBe(false);
      expect(snapshot.lastStartAt).toBeNull();
      expect(snapshot.lastStopAt).toBeNull();
      expect(snapshot.lastError).toBeNull();
      expect(snapshot.lastInboundAt).toBeUndefined();
      expect(snapshot.lastOutboundAt).toBeUndefined();
    });

    it("should mark as configured when channelId is present", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "acc789",
        enabled: true,
        config: {
          enabled: true,
          channelId: "ch789",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const snapshot = statusAdapter.buildAccountSnapshot({ account });

      expect(snapshot.configured).toBe(true);
    });

    it("should mark as not configured when channelId is empty", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "acc000",
        enabled: true,
        config: {
          enabled: true,
          channelId: "",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const snapshot = statusAdapter.buildAccountSnapshot({ account });

      expect(snapshot.configured).toBe(false);
    });
  });

  describe("collectStatusIssues", () => {
    it("should warn when account is configured but disabled", () => {
      const accounts: ChannelAccountSnapshot[] = [
        {
          accountId: "acc1",
          name: "Channel 1",
          enabled: false,
          configured: true,
          mode: "direct",
          running: false,
          lastStartAt: null,
          lastStopAt: null,
          lastError: null,
        },
      ];

      const issues = statusAdapter.collectStatusIssues(accounts);

      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          message: expect.stringContaining("configured but disabled"),
          accountId: "acc1",
        })
      );
    });

    it("should error when relay server is unreachable", () => {
      const accounts: ChannelAccountSnapshot[] = [
        {
          accountId: "acc2",
          name: "Relay Channel",
          enabled: true,
          configured: true,
          mode: "relay",
          running: true,
          lastStartAt: "2025-01-31T10:00:00Z",
          lastStopAt: null,
          lastError: null,
          probe: { ok: false, error: "Connection refused" },
        },
      ];

      const issues = statusAdapter.collectStatusIssues(accounts);

      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "error",
          message: expect.stringContaining("relay server unreachable"),
          accountId: "acc2",
        })
      );
    });

    it("should warn when account has not received messages for 30+ minutes", () => {
      const thirtyMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const accounts: ChannelAccountSnapshot[] = [
        {
          accountId: "acc3",
          name: "Silent Channel",
          enabled: true,
          configured: true,
          mode: "direct",
          running: true,
          lastStartAt: "2025-01-31T09:00:00Z",
          lastStopAt: null,
          lastError: null,
          lastInboundAt: thirtyMinutesAgo,
        },
      ];

      const issues = statusAdapter.collectStatusIssues(accounts);

      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          message: expect.stringContaining("has not received messages"),
          accountId: "acc3",
        })
      );
    });

    it("should not warn when account has received messages within 30 minutes", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const accounts: ChannelAccountSnapshot[] = [
        {
          accountId: "acc4",
          name: "Active Channel",
          enabled: true,
          configured: true,
          mode: "direct",
          running: true,
          lastStartAt: "2025-01-31T09:00:00Z",
          lastStopAt: null,
          lastError: null,
          lastInboundAt: fiveMinutesAgo,
        },
      ];

      const issues = statusAdapter.collectStatusIssues(accounts);

      const silenceWarnings = issues.filter((i) =>
        i.message.includes("has not received messages")
      );
      expect(silenceWarnings).toHaveLength(0);
    });

    it("should not warn about silence when account is not running", () => {
      const thirtyMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const accounts: ChannelAccountSnapshot[] = [
        {
          accountId: "acc5",
          name: "Stopped Channel",
          enabled: true,
          configured: true,
          mode: "direct",
          running: false,
          lastStartAt: "2025-01-31T09:00:00Z",
          lastStopAt: "2025-01-31T09:30:00Z",
          lastError: null,
          lastInboundAt: thirtyMinutesAgo,
        },
      ];

      const issues = statusAdapter.collectStatusIssues(accounts);

      const silenceWarnings = issues.filter((i) =>
        i.message.includes("has not received messages")
      );
      expect(silenceWarnings).toHaveLength(0);
    });

    it("should collect multiple issues from multiple accounts", () => {
      const thirtyMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const accounts: ChannelAccountSnapshot[] = [
        {
          accountId: "acc6",
          name: "Disabled Channel",
          enabled: false,
          configured: true,
          mode: "direct",
          running: false,
          lastStartAt: null,
          lastStopAt: null,
          lastError: null,
        },
        {
          accountId: "acc7",
          name: "Relay Channel",
          enabled: true,
          configured: true,
          mode: "relay",
          running: true,
          lastStartAt: "2025-01-31T10:00:00Z",
          lastStopAt: null,
          lastError: null,
          probe: { ok: false, error: "Timeout" },
        },
        {
          accountId: "acc8",
          name: "Silent Channel",
          enabled: true,
          configured: true,
          mode: "direct",
          running: true,
          lastStartAt: "2025-01-31T09:00:00Z",
          lastStopAt: null,
          lastError: null,
          lastInboundAt: thirtyMinutesAgo,
        },
      ];

      const issues = statusAdapter.collectStatusIssues(accounts);

      expect(issues.length).toBeGreaterThanOrEqual(3);
      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          accountId: "acc6",
        })
      );
      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "error",
          accountId: "acc7",
        })
      );
      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          accountId: "acc8",
        })
      );
    });

    it("should return empty array when all accounts are healthy", () => {
      const accounts: ChannelAccountSnapshot[] = [
        {
          accountId: "acc9",
          name: "Healthy Channel",
          enabled: true,
          configured: true,
          mode: "direct",
          running: true,
          lastStartAt: "2025-01-31T10:00:00Z",
          lastStopAt: null,
          lastError: null,
          lastInboundAt: new Date().toISOString(),
        },
      ];

      const issues = statusAdapter.collectStatusIssues(accounts);

      expect(issues).toHaveLength(0);
    });
  });
});
