/**
 * ChannelConfigAdapter tests
 * 
 * Tests for configAdapter implementation with 6+ test cases covering:
 * - listTalkChannelIds: extract talkchannel IDs from config
 * - resolveTalkChannel: resolve account with validation
 * - defaultTalkChannelId: return default or first account
 * - isConfigured: check if talkchannel has channelId
 * - isEnabled: check if talkchannel is enabled
 * - Edge cases: missing config, empty talkchannels, disabled talkchannels
 */
import { describe, it, expect } from "vitest";
import { configAdapter } from "../../../src/adapters/config";

describe("ChannelConfigAdapter", () => {
  describe("listTalkChannelIds", () => {
    it("should return array of talkchannel IDs from valid config", () => {
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
              secondary: {
                enabled: false,
                channelId: "channel456",
                mode: "relay" as const,
                dmPolicy: "open" as const,
              },
            },
          },
        },
      };

      const ids = configAdapter.listTalkChannelIds(cfg);

      expect(ids).toEqual(["default", "secondary"]);
    });

    it("should return empty array when no talkchannels configured", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {},
          },
        },
      };

      const ids = configAdapter.listTalkChannelIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when config is missing kakao channel", () => {
      const cfg = {
        channels: {},
      };

      const ids = configAdapter.listTalkChannelIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when config is null or undefined", () => {
      expect(configAdapter.listTalkChannelIds(null)).toEqual([]);
      expect(configAdapter.listTalkChannelIds(undefined)).toEqual([]);
    });
  });

  describe("resolveTalkChannel", () => {
    it("should resolve account with valid config", () => {
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

      const talkchannel = configAdapter.resolveTalkChannel(cfg, "default");

      expect(talkchannel.talkchannelId).toBe("default");
      expect(talkchannel.config.channelId).toBe("channel123");
      expect(talkchannel.config.enabled).toBe(true);
      expect(talkchannel.enabled).toBe(true);
    });

    it("should throw error when talkchannel not found", () => {
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

      expect(() => configAdapter.resolveTalkChannel(cfg, "nonexistent")).toThrow(
        /not found/i
      );
    });

    it("should throw error when config is invalid", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              default: {
                enabled: true,
                // Missing required channelId
                mode: "direct" as const,
                dmPolicy: "pairing" as const,
              },
            },
          },
        },
      };

      expect(() => configAdapter.resolveTalkChannel(cfg, "default")).toThrow();
    });
  });

  describe("defaultTalkChannelId", () => {
    it("should return 'default' when it exists", () => {
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
              secondary: {
                enabled: true,
                channelId: "channel456",
                mode: "direct" as const,
                dmPolicy: "pairing" as const,
              },
            },
          },
        },
      };

      const id = configAdapter.defaultTalkChannelId(cfg);

      expect(id).toBe("default");
    });

    it("should return first account ID when 'default' does not exist", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            talkchannels: {
              primary: {
                enabled: true,
                channelId: "channel123",
                mode: "direct" as const,
                dmPolicy: "pairing" as const,
              },
              secondary: {
                enabled: true,
                channelId: "channel456",
                mode: "direct" as const,
                dmPolicy: "pairing" as const,
              },
            },
          },
        },
      };

      const id = configAdapter.defaultTalkChannelId(cfg);

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

      expect(() => configAdapter.defaultTalkChannelId(cfg)).toThrow(
        /no.*talkchannels/i
      );
    });
  });

  describe("isConfigured", () => {
    it("should return true when talkchannel has channelId", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(talkchannel)).toBe(true);
    });

    it("should return false when talkchannel has empty channelId", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
          channelId: "",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(talkchannel)).toBe(false);
    });

    it("should return false when talkchannel has no channelId", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
          channelId: undefined as any,
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(talkchannel)).toBe(false);
    });
  });

  describe("isEnabled", () => {
    it("should return true when talkchannel is enabled", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isEnabled(talkchannel)).toBe(true);
    });

    it("should return false when talkchannel is disabled", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: false,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: false,
      };

      expect(configAdapter.isEnabled(talkchannel)).toBe(false);
    });

    it("should return false when config.enabled is false", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: false,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isEnabled(talkchannel)).toBe(false);
    });
  });

  describe("Integration: Full workflow", () => {
    it("should list, resolve, and check status of accounts", () => {
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
              secondary: {
                enabled: false,
                channelId: "channel456",
                mode: "relay" as const,
                dmPolicy: "open" as const,
              },
            },
          },
        },
      };

      // List accounts
      const ids = configAdapter.listTalkChannelIds(cfg);
      expect(ids).toContain("default");
      expect(ids).toContain("secondary");

      // Resolve default account
      const defaultTalkChannel = configAdapter.resolveTalkChannel(cfg, "default");
      expect(configAdapter.isConfigured(defaultTalkChannel)).toBe(true);
      expect(configAdapter.isEnabled(defaultTalkChannel)).toBe(true);

      // Resolve secondary account
      const secondaryTalkChannel = configAdapter.resolveTalkChannel(cfg, "secondary");
      expect(configAdapter.isConfigured(secondaryTalkChannel)).toBe(true);
      expect(configAdapter.isEnabled(secondaryTalkChannel)).toBe(false);

      // Get default account ID
      const defaultId = configAdapter.defaultTalkChannelId(cfg);
      expect(defaultId).toBe("default");
    });
  });
});
