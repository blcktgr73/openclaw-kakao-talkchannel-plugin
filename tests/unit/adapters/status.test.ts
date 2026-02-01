/**
 * ChannelStatusAdapter tests (Simplified)
 *
 * Relay mode only status monitoring.
 */
import { describe, it, expect, vi } from "vitest";
import { statusAdapter } from "../../../src/adapters/status";
import type {
  ChannelTalkChannelSnapshot,
  TalkChannelRuntime,
} from "../../../src/adapters/status";
import type { ResolvedKakaoTalkChannel } from "../../../src/types";

describe("ChannelStatusAdapter (Simplified)", () => {
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
    it("should probe relay server health endpoint", async () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
          dmPolicy: "open",
          relayUrl: "https://relay.example.com",
          relayToken: "token123",
        },
      };

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
        talkchannelId: "default",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
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
        talkchannelId: "default",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
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
        talkchannelId: "default",
        enabled: true,
        name: "Relay Channel",
        config: {
          enabled: true,
          channelId: "ch456",
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
        talkchannelId: "default",
        enabled: true,
        name: "Test Channel",
        config: {
          enabled: true,
          channelId: "ch123",
          dmPolicy: "pairing",
          relayUrl: "https://relay.example.com",
        },
      };

      const runtime: TalkChannelRuntime = {
        talkchannelId: "default",
        running: true,
        lastStartAt: "2025-01-31T10:00:00Z",
        lastStopAt: null,
        lastError: null,
        lastInboundAt: "2025-01-31T10:30:00Z",
        lastOutboundAt: "2025-01-31T10:31:00Z",
      };

      const probe = { ok: true, latencyMs: 45 };

      const snapshot = statusAdapter.buildTalkChannelSnapshot({
        talkchannel,
        runtime,
        probe,
      });

      expect(snapshot.talkchannelId).toBe("default");
      expect(snapshot.name).toBe("ch123");
      expect(snapshot.enabled).toBe(true);
      expect(snapshot.configured).toBe(true);
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
        talkchannelId: "default",
        enabled: false,
        config: {
          enabled: false,
          channelId: "ch456",
          dmPolicy: "open",
        },
      };

      const snapshot = statusAdapter.buildTalkChannelSnapshot({ talkchannel });

      expect(snapshot.talkchannelId).toBe("default");
      expect(snapshot.enabled).toBe(false);
      expect(snapshot.running).toBe(false);
      expect(snapshot.lastStartAt).toBeNull();
      expect(snapshot.lastStopAt).toBeNull();
      expect(snapshot.lastError).toBeNull();
      expect(snapshot.lastInboundAt).toBeUndefined();
      expect(snapshot.lastOutboundAt).toBeUndefined();
    });

    it("should mark as configured when relayUrl is present", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          dmPolicy: "pairing",
          relayUrl: "https://relay.example.com",
        },
      };

      const snapshot = statusAdapter.buildTalkChannelSnapshot({ talkchannel });

      expect(snapshot.configured).toBe(true);
    });

    it("should mark as not configured when relayUrl is empty", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          dmPolicy: "pairing",
          relayUrl: "",
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
          talkchannelId: "default",
          name: "Channel 1",
          enabled: false,
          configured: true,
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
          talkchannelId: "default",
        })
      );
    });

    it("should error when relay server is unreachable", () => {
      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "default",
          name: "Relay Channel",
          enabled: true,
          configured: true,
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
          talkchannelId: "default",
        })
      );
    });

    it("should warn when talkchannel has not received messages for 30+ minutes", () => {
      const thirtyMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();

      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "default",
          name: "Silent Channel",
          enabled: true,
          configured: true,
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
          talkchannelId: "default",
        })
      );
    });

    it("should not warn when talkchannel has received messages within 30 minutes", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "default",
          name: "Active Channel",
          enabled: true,
          configured: true,
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
          talkchannelId: "default",
          name: "Stopped Channel",
          enabled: true,
          configured: true,
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

    it("should return empty array when all talkchannels are healthy", () => {
      const talkchannels: ChannelTalkChannelSnapshot[] = [
        {
          talkchannelId: "default",
          name: "Healthy Channel",
          enabled: true,
          configured: true,
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
