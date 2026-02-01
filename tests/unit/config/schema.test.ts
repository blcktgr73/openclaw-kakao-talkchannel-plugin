import { describe, it, expect } from "vitest";
import {
  KakaoTalkChannelConfigSchema,
  KakaoChannelConfigSchema,
  validateTalkChannelConfig,
} from "../../../src/config/schema";

describe("Config Schema", () => {
  describe("KakaoTalkChannelConfigSchema", () => {
    it("should accept valid direct mode config", () => {
      const config = {
        enabled: true,
        channelId: "channel123",
        mode: "direct",
        dmPolicy: "pairing",
        webhookPath: "/kakao-talkchannel/webhook",
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.mode).toBe("direct");
      }
    });

    it("should accept valid relay mode config", () => {
      const config = {
        enabled: true,
        channelId: "channel123",
        mode: "relay",
        dmPolicy: "pairing",
        relayUrl: "https://relay.example.com",
        relayToken: "secret_token",
        reconnectDelayMs: 2000,
        maxReconnectDelayMs: 15000,
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should apply default values", () => {
      const config = {
        channelId: "channel123",
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.mode).toBe("direct");
        expect(result.data.dmPolicy).toBe("pairing");
        expect(result.data.webhookPath).toBe("/kakao-talkchannel/webhook");
        expect(result.data.reconnectDelayMs).toBe(1000);
        expect(result.data.maxReconnectDelayMs).toBe(30000);
        expect(result.data.callbackTimeoutMs).toBe(55000);
      }
    });

    it("should reject missing channelId in direct mode", () => {
      const config = {
        enabled: true,
        mode: "direct",
      };

      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should allow missing channelId in relay mode", () => {
      const config = {
        enabled: true,
        mode: "relay",
      };

      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject empty channelId", () => {
      const config = {
        channelId: "",
        mode: "direct",
      };

      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject invalid mode", () => {
      const config = {
        channelId: "ch1",
        mode: "invalid",
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject invalid dmPolicy", () => {
      const config = {
        channelId: "ch1",
        dmPolicy: "invalid",
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject reconnectDelayMs below minimum", () => {
      const config = {
        channelId: "ch1",
        reconnectDelayMs: 100,
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject reconnectDelayMs above maximum", () => {
      const config = {
        channelId: "ch1",
        reconnectDelayMs: 60000,
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject maxReconnectDelayMs below minimum", () => {
      const config = {
        channelId: "ch1",
        maxReconnectDelayMs: 1000,
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject maxReconnectDelayMs above maximum", () => {
      const config = {
        channelId: "ch1",
        maxReconnectDelayMs: 120000,
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should validate relayUrl as URL", () => {
      const config = {
        channelId: "ch1",
        relayUrl: "not-a-url",
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should accept valid allowFrom array", () => {
      const config = {
        channelId: "ch1",
        allowFrom: ["user1", "user2"],
      };
      
      const result = KakaoTalkChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowFrom).toEqual(["user1", "user2"]);
      }
    });
  });

  describe("KakaoChannelConfigSchema", () => {
    it("should accept empty accounts object", () => {
      const config = {
        enabled: true,
      };
      
      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.talkchannels).toEqual({});
      }
    });

    it("should accept multiple accounts", () => {
      const config = {
        enabled: true,
        talkchannels: {
          default: { channelId: "ch1" },
          secondary: { channelId: "ch2", mode: "relay", relayUrl: "https://relay.example.com" },
        },
      };
      
      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe("validateTalkChannelConfig", () => {
    it("should return ok: true for valid config", () => {
      const result = validateTalkChannelConfig({ channelId: "ch1" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.channelId).toBe("ch1");
      }
    });

    it("should return ok: false with errors for invalid config", () => {
      const result = validateTalkChannelConfig({ enabled: true });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("channelId");
      }
    });

    it("should format error paths correctly", () => {
      const result = validateTalkChannelConfig({ channelId: "ch1", reconnectDelayMs: 100 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some(e => e.includes("reconnectDelayMs"))).toBe(true);
      }
    });
  });
});
