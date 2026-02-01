/**
 * ChannelConfigAdapter tests (Simplified)
 *
 * Single channel, relay mode only.
 */
import { describe, it, expect } from "vitest";
import { configAdapter } from "../../../src/adapters/config";

describe("ChannelConfigAdapter (Simplified)", () => {
  describe("listAccountIds", () => {
    it("should always return ['default'] (single channel)", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
          },
        },
      };

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);
    });

    it("should return ['default'] even when kakao channel not configured", () => {
      const cfg = {
        channels: {},
      };

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);
    });

    it("should return ['default'] even when channels missing", () => {
      const cfg = {};

      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);
    });

    it("should return ['default'] even when config is null or undefined", () => {
      expect(configAdapter.listAccountIds(null)).toEqual(["default"]);
      expect(configAdapter.listAccountIds(undefined)).toEqual(["default"]);
    });
  });

  describe("resolveAccount", () => {
    it("should resolve talkchannel with valid config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            channelId: "channel123",
            dmPolicy: "pairing",
          },
        },
      };

      const talkchannel = configAdapter.resolveAccount(cfg, "default");

      expect(talkchannel.talkchannelId).toBe("default");
      expect(talkchannel.config.channelId).toBe("channel123");
      expect(talkchannel.config.enabled).toBe(true);
      expect(talkchannel.enabled).toBe(true);
    });

    it("should apply schema defaults when resolving", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {},
        },
      };

      const talkchannel = configAdapter.resolveAccount(cfg, "default");

      expect(talkchannel.config.enabled).toBe(true);
      expect(talkchannel.config.dmPolicy).toBe("pairing");
      expect(talkchannel.config.relayUrl).toBe("https://k.tess.dev/");
      expect(talkchannel.config.reconnectDelayMs).toBe(1000);
      expect(talkchannel.config.maxReconnectDelayMs).toBe(30000);
      expect(talkchannel.config.callbackTimeoutMs).toBe(55000);
    });

    it("should use defaults when kakao channel not configured", () => {
      const cfg = {
        channels: {},
      };

      const talkchannel = configAdapter.resolveAccount(cfg, "default");
      expect(talkchannel.talkchannelId).toBe("default");
      expect(talkchannel.config.enabled).toBe(true);
      expect(talkchannel.config.dmPolicy).toBe("pairing");
    });

    it("should use defaults when channels missing", () => {
      const cfg = {};

      const talkchannel = configAdapter.resolveAccount(cfg, "default");
      expect(talkchannel.talkchannelId).toBe("default");
      expect(talkchannel.config.enabled).toBe(true);
    });

    it("should use defaults when config is null or undefined", () => {
      const talkchannel1 = configAdapter.resolveAccount(null, "default");
      expect(talkchannel1.config.enabled).toBe(true);

      const talkchannel2 = configAdapter.resolveAccount(undefined, "default");
      expect(talkchannel2.config.enabled).toBe(true);
    });

    it("should resolve relay mode settings", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            channelId: "relay_ch",
            relayUrl: "https://relay.example.com",
            relayToken: "secret_token",
            reconnectDelayMs: 2000,
            maxReconnectDelayMs: 15000,
            dmPolicy: "open",
          },
        },
      };

      const talkchannel = configAdapter.resolveAccount(cfg, "default");

      expect(talkchannel.talkchannelId).toBe("default");
      expect(talkchannel.config.relayUrl).toBe("https://relay.example.com");
      expect(talkchannel.config.relayToken).toBe("secret_token");
      expect(talkchannel.config.reconnectDelayMs).toBe(2000);
      expect(talkchannel.config.maxReconnectDelayMs).toBe(15000);
    });

    it("should set enabled field based on config.enabled", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: false,
          },
        },
      };

      const talkchannel = configAdapter.resolveAccount(cfg, "default");

      expect(talkchannel.enabled).toBe(false);
      expect(talkchannel.config.enabled).toBe(false);
    });

    it("should include optional name field when present", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            name: "My Kakao Bot",
          },
        },
      };

      const talkchannel = configAdapter.resolveAccount(cfg, "default");

      expect(talkchannel.name).toBe("My Kakao Bot");
    });

    it("should throw error on invalid config data", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            channelId: "", // empty channelId is invalid
          },
        },
      };

      expect(() => configAdapter.resolveAccount(cfg, "default")).toThrow();
    });
  });

  describe("defaultAccountId", () => {
    it("should always return 'default'", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
          },
        },
      };

      const id = configAdapter.defaultAccountId(cfg);
      expect(id).toBe("default");
    });

    it("should return 'default' even when kakao channel not configured", () => {
      const cfg = {
        channels: {},
      };

      const id = configAdapter.defaultAccountId(cfg);
      expect(id).toBe("default");
    });

    it("should return 'default' even when config is null or undefined", () => {
      expect(configAdapter.defaultAccountId(null)).toBe("default");
      expect(configAdapter.defaultAccountId(undefined)).toBe("default");
    });
  });

  describe("isConfigured", () => {
    it("should always return true for relay mode (can auto-create session)", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(talkchannel)).toBe(true);
    });

    it("should return true when sessionToken is set", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
          dmPolicy: "pairing" as const,
          sessionToken: "session123",
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(talkchannel)).toBe(true);
    });

    it("should return true when relayToken is set", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
          dmPolicy: "pairing" as const,
          relayToken: "token123",
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(talkchannel)).toBe(true);
    });
  });

  describe("isEnabled", () => {
    it("should return true when talkchannel is enabled", () => {
      const talkchannel = {
        talkchannelId: "default",
        config: {
          enabled: true,
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
          dmPolicy: "pairing" as const,
        },
        enabled: false,
      };

      expect(configAdapter.isEnabled(talkchannel)).toBe(false);
    });
  });

  describe("Integration: Full workflow", () => {
    it("should list, resolve, and check status of single channel", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            channelId: "channel123",
            dmPolicy: "pairing",
          },
        },
      };

      // List talkchannels
      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toEqual(["default"]);

      // Resolve channel
      const talkchannel = configAdapter.resolveAccount(cfg, "default");
      expect(configAdapter.isConfigured(talkchannel)).toBe(true);
      expect(configAdapter.isEnabled(talkchannel)).toBe(true);

      // Get default talkchannel ID
      const defaultId = configAdapter.defaultAccountId(cfg);
      expect(defaultId).toBe("default");
    });
  });
});
