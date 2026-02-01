/**
 * ChannelStatusAdapter tests
 *
 * Tests for statusAdapter implementation with 8+ test cases covering:
 * - defaultRuntime: default runtime state
 * - probeTalkChannel: health check for relay/direct modes
 * - buildTalkChannelSnapshot: build talkchannel snapshot from talkchannel + runtime + probe
 * - collectStatusIssues: collect status issues from snapshots
 * - Edge cases: disabled talkchannels, relay errors, message silence
 */
import { describe, it, expect, vi } from "vitest";
import { statusAdapter } from "../../../src/adapters/status";
import type {
  ChannelTalkChannelSnapshot,
  TalkChannelRuntime,
} from "../../../src/adapters/status";
import type { ResolvedKakaoTalkChannel } from "../../../src/types";

describe("ChannelStatusAdapter", () => {
  describe("defaultRuntime", () => {
    it("should provide default runtime with all null/false values", () => {
      const runtime = statusAdapter.defaultRuntime;

      expect(runtime.talkchannelId).toBe("default");
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

  describe("probeTalkChannel", () => {
    it("should return ok=true for direct mode talkchannels", async () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "direct-account",
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

      const result = await statusAdapter.probeTalkChannel({ talkchannel });

      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should probe relay server for relay mode talkchannels", async () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "relay-account",
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

      const result = await statusAdapter.probeTalkChannel({ talkchannel });

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
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "relay-account",
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

      const result = await statusAdapter.probeTalkChannel({ talkchannel });

      expect(result.ok).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return error when relay server returns non-200 status", async () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "relay-account",
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

      const result = await statusAdapter.probeTalkChannel({ talkchannel });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("503");
    });

    it("should return error when relay URL is not configured", async () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "relay-account",
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

      const result = await statusAdapter.probeTalkChannel({ talkchannel });

      expect(result.ok).toBe(false);
      expect(result.error).toContain("relayUrl");
    });
  });

  describe("buildTalkChannelSnapshot", () => {
    it("should build snapshot with all fields from talkchannel and runtime", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "acc123",
        enabled: true,
        name: "Test Channel",
        config: {
          enabled: true,
          channelId: "ch123",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const runtime: TalkChannelRuntime = {
        talkchannelId: "acc123",
        running: true,
        lastStartAt: "2025-01-31T10:00:00Z",
        lastStopAt: null,
        lastError: null,
        lastInboundAt: "2025-01-31T10:30:00Z",
        lastOutboundAt: "2025-01-31T10:31:00Z",
      };

      const probe = { ok: true, latencyMs: 45 };

      const snapshot = statusAdapter.buildTalkChannelSnapshot({
        talkchannel: talkchannel,
        runtime,
        probe,
      });

      expect(snapshot.talkchannelId).toBe("acc123");
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
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "acc456",
        enabled: false,
        config: {
          enabled: false,
          channelId: "ch456",
          mode: "relay",
          dmPolicy: "open",
        },
      };

      const snapshot = statusAdapter.buildTalkChannelSnapshot({ talkchannel });

      expect(snapshot.talkchannelId).toBe("acc456");
      expect(snapshot.enabled).toBe(false);
      expect(snapshot.running).toBe(false);
      expect(snapshot.lastStartAt).toBeNull();
      expect(snapshot.lastStopAt).toBeNull();
      expect(snapshot.lastError).toBeNull();
      expect(snapshot.lastInboundAt).toBeUndefined();
      expect(snapshot.lastOutboundAt).toBeUndefined();
    });

    it("should mark as configured when channelId is present", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "acc789",
        enabled: true,
        config: {
          enabled: true,
          channelId: "ch789",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const snapshot = statusAdapter.buildTalkChannelSnapshot({ talkchannel });

      expect(snapshot.configured).toBe(true);
    });

    it("should mark as not configured when channelId is empty", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "acc000",
        enabled: true,
        config: {
          enabled: true,
          channelId: "",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const snapshot = statusAdapter.buildTalkChannelSnapshot({ talkchannel });

      expect(snapshot.configured).toBe(false);
    });
  });

  describe("collectStatusIssues", () => {
    it("should warn when talkchannel is configured but disabled", () => {
      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "acc1",
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

      const issues = statusAdapter.collectStatusIssues(talkchannels);

      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          message: expect.stringContaining("configured but disabled"),
          talkchannelId: "acc1",
        })
      );
    });

    it("should error when relay server is unreachable", () => {
      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "acc2",
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

      const issues = statusAdapter.collectStatusIssues(talkchannels);

      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "error",
          message: expect.stringContaining("relay server unreachable"),
          talkchannelId: "acc2",
        })
      );
    });

    it("should warn when talkchannel has not received messages for 30+ minutes", () => {
      const thirtyMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "acc3",
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

      const issues = statusAdapter.collectStatusIssues(talkchannels);

      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          message: expect.stringContaining("has not received messages"),
          talkchannelId: "acc3",
        })
      );
    });

    it("should not warn when talkchannel has received messages within 30 minutes", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "acc4",
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

      const issues = statusAdapter.collectStatusIssues(talkchannels);

      const silenceWarnings = issues.filter((i) =>
        i.message.includes("has not received messages")
      );
      expect(silenceWarnings).toHaveLength(0);
    });

    it("should not warn about silence when talkchannel is not running", () => {
      const thirtyMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "acc5",
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

      const issues = statusAdapter.collectStatusIssues(talkchannels);

      const silenceWarnings = issues.filter((i) =>
        i.message.includes("has not received messages")
      );
      expect(silenceWarnings).toHaveLength(0);
    });

    it("should collect multiple issues from multiple talkchannels", () => {
      const thirtyMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "acc6",
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
          talkchannelId: "acc7",
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
          talkchannelId: "acc8",
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

      const issues = statusAdapter.collectStatusIssues(talkchannels);

      expect(issues.length).toBeGreaterThanOrEqual(3);
      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          talkchannelId: "acc6",
        })
      );
      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "error",
          talkchannelId: "acc7",
        })
      );
      expect(issues).toContainEqual(
        expect.objectContaining({
          level: "warn",
          talkchannelId: "acc8",
        })
      );
    });

    it("should return empty array when all talkchannels are healthy", () => {
      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "acc9",
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

      const issues = statusAdapter.collectStatusIssues(talkchannels);

      expect(issues).toHaveLength(0);
    });
  });
});
