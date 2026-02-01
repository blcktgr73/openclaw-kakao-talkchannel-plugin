/**
 * TalkChannel resolution tests
 *
 * Tests for resolveKakaoTalkChannel, listKakaoTalkChannelIds, and getDefaultTalkChannelId
 */
import { describe, it, expect } from "vitest";
import {
  resolveKakaoTalkChannel,
  listKakaoTalkChannelIds,
  getDefaultTalkChannelId,
} from "../../../src/config/talkchannels";

describe("TalkChannel Resolution", () => {
  describe("resolveKakaoTalkChannel", () => {
    it("should resolve talkchannel from valid config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              default: {
                enabled: true,
                channelId: "channel123",
                mode: "direct" as const,
                dmPolicy: "pairing" as const,
              },
            },
          },
        },
      };

      const talkchannel = resolveKakaoTalkChannel(cfg, "default");

      expect(talkchannel.talkchannelId).toBe("default");
      expect(talkchannel.config.channelId).toBe("channel123");
      expect(talkchannel.config.enabled).toBe(true);
      expect(talkchannel.enabled).toBe(true);
    });

    it("should apply schema defaults when resolving", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              default: {
                channelId: "channel123",
              },
            },
          },
        },
      };

      const talkchannel = resolveKakaoTalkChannel(cfg, "default");

      expect(talkchannel.config.enabled).toBe(true);
      expect(talkchannel.config.mode).toBe("direct");
      expect(talkchannel.config.dmPolicy).toBe("pairing");
      expect(talkchannel.config.webhookPath).toBe("/kakao-talkchannel/webhook");
      expect(talkchannel.config.reconnectDelayMs).toBe(1000);
      expect(talkchannel.config.maxReconnectDelayMs).toBe(30000);
      expect(talkchannel.config.callbackTimeoutMs).toBe(55000);
    });

    it("should throw error when talkchannel not found", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {},
          },
        },
      };

      expect(() => resolveKakaoTalkChannel(cfg, "missing")).toThrow(
        /talkchannel.*not found/i
      );
    });

    it("should throw error when channels.kakao-talkchannel missing", () => {
      const cfg = {
        channels: {},
      };

      expect(() => resolveKakaoTalkChannel(cfg, "default")).toThrow(
        /kakao.*not configured/i
      );
    });

    it("should throw error when channels missing", () => {
      const cfg = {};

      expect(() => resolveKakaoTalkChannel(cfg, "default")).toThrow(
        /kakao.*not configured/i
      );
    });

    it("should resolve relay mode talkchannel with all settings", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              relay_talkchannel: {
                enabled: true,
                channelId: "relay_ch",
                mode: "relay" as const,
                relayUrl: "https://relay.example.com",
                relayToken: "secret_token",
                reconnectDelayMs: 2000,
                maxReconnectDelayMs: 15000,
                dmPolicy: "open" as const,
              },
            },
          },
        },
      };

      const talkchannel = resolveKakaoTalkChannel(cfg, "relay_talkchannel");

      expect(talkchannel.talkchannelId).toBe("relay_talkchannel");
      expect(talkchannel.config.mode).toBe("relay");
      expect(talkchannel.config.relayUrl).toBe("https://relay.example.com");
      expect(talkchannel.config.relayToken).toBe("secret_token");
      expect(talkchannel.config.reconnectDelayMs).toBe(2000);
      expect(talkchannel.config.maxReconnectDelayMs).toBe(15000);
    });

    it("should set enabled field based on config.enabled", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              disabled: {
                enabled: false,
                channelId: "ch1",
              },
            },
          },
        },
      };

      const talkchannel = resolveKakaoTalkChannel(cfg, "disabled");

      expect(talkchannel.enabled).toBe(false);
      expect(talkchannel.config.enabled).toBe(false);
    });

    it("should include optional name field when present", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              named: {
                enabled: true,
                channelId: "ch1",
                name: "My Kakao Bot",
              },
            },
          },
        },
      };

      const talkchannel = resolveKakaoTalkChannel(cfg, "named");

      expect(talkchannel.name).toBe("My Kakao Bot");
    });

    it("should validate config and throw on invalid data", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              invalid: {
                channelId: "",
              },
            },
          },
        },
      };

      expect(() => resolveKakaoTalkChannel(cfg, "invalid")).toThrow();
    });
  });

  describe("listKakaoTalkChannelIds", () => {
    it("should return list of talkchannel IDs", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              default: { channelId: "ch1" },
              secondary: { channelId: "ch2" },
              tertiary: { channelId: "ch3" },
            },
          },
        },
      };

      const ids = listKakaoTalkChannelIds(cfg);

      expect(ids).toContain("default");
      expect(ids).toContain("secondary");
      expect(ids).toContain("tertiary");
      expect(ids.length).toBe(3);
    });

    it("should return empty array when no talkchannels configured", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {},
          },
        },
      };

      const ids = listKakaoTalkChannelIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when kakao not configured", () => {
      const cfg = {
        channels: {},
      };

      const ids = listKakaoTalkChannelIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when channels missing", () => {
      const cfg = {};

      const ids = listKakaoTalkChannelIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should handle unknown config structure gracefully", () => {
      const cfg = null;

      const ids = listKakaoTalkChannelIds(cfg);

      expect(ids).toEqual([]);
    });
  });

  describe("getDefaultTalkChannelId", () => {
    it("should return 'default' when it exists", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              default: { channelId: "ch1" },
              secondary: { channelId: "ch2" },
            },
          },
        },
      };

      const id = getDefaultTalkChannelId(cfg);

      expect(id).toBe("default");
    });

    it("should return first talkchannel ID when 'default' does not exist", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              primary: { channelId: "ch1" },
              secondary: { channelId: "ch2" },
            },
          },
        },
      };

      const id = getDefaultTalkChannelId(cfg);

      expect(id).toBe("primary");
    });

    it("should throw error when no talkchannels configured", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {},
          },
        },
      };

      expect(() => getDefaultTalkChannelId(cfg)).toThrow(
        /no.*talkchannel.*configured/i
      );
    });

    it("should throw error when kakao not configured", () => {
      const cfg = {
        channels: {},
      };

      expect(() => getDefaultTalkChannelId(cfg)).toThrow(
        /no.*talkchannel.*configured/i
      );
    });

    it("should throw error when channels missing", () => {
      const cfg = {};

      expect(() => getDefaultTalkChannelId(cfg)).toThrow(
        /no.*talkchannel.*configured/i
      );
    });
  });
});
