import { describe, it, expect } from "vitest";
import {
  KakaoChannelConfigSchema,
  validateChannelConfig,
} from "../../../src/config/schema";

describe("Config Schema (Simplified)", () => {
  describe("KakaoChannelConfigSchema", () => {
    it("should accept minimal relay mode config", () => {
      const config = {
        enabled: true,
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.dmPolicy).toBe("pairing");
        expect(result.data.relayUrl).toBe("https://k.tess.dev/");
      }
    });

    it("should accept full relay mode config", () => {
      const config = {
        enabled: true,
        channelId: "channel123",
        dmPolicy: "pairing",
        relayUrl: "https://relay.example.com",
        relayToken: "secret_token",
        reconnectDelayMs: 2000,
        maxReconnectDelayMs: 15000,
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relayUrl).toBe("https://relay.example.com");
        expect(result.data.relayToken).toBe("secret_token");
        expect(result.data.reconnectDelayMs).toBe(2000);
        expect(result.data.maxReconnectDelayMs).toBe(15000);
      }
    });

    it("should apply default values", () => {
      const config = {};

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.dmPolicy).toBe("pairing");
        expect(result.data.relayUrl).toBe("https://k.tess.dev/");
        expect(result.data.reconnectDelayMs).toBe(1000);
        expect(result.data.maxReconnectDelayMs).toBe(30000);
        expect(result.data.callbackTimeoutMs).toBe(55000);
      }
    });

    it("should allow channelId to be optional", () => {
      const config = {
        enabled: true,
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.channelId).toBeUndefined();
      }
    });

    it("should reject empty channelId", () => {
      const config = {
        channelId: "",
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject invalid dmPolicy", () => {
      const config = {
        dmPolicy: "invalid",
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject reconnectDelayMs below minimum", () => {
      const config = {
        reconnectDelayMs: 100,
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject reconnectDelayMs above maximum", () => {
      const config = {
        reconnectDelayMs: 60000,
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject maxReconnectDelayMs below minimum", () => {
      const config = {
        maxReconnectDelayMs: 1000,
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should reject maxReconnectDelayMs above maximum", () => {
      const config = {
        maxReconnectDelayMs: 120000,
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should validate relayUrl as URL", () => {
      const config = {
        relayUrl: "not-a-url",
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should accept valid allowFrom array", () => {
      const config = {
        allowFrom: ["user1", "user2"],
      };

      const result = KakaoChannelConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.allowFrom).toEqual(["user1", "user2"]);
      }
    });
  });

  describe("validateChannelConfig", () => {
    it("should return ok: true for valid config", () => {
      const result = validateChannelConfig({});
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.enabled).toBe(true);
      }
    });

    it("should return ok: true for config with channelId", () => {
      const result = validateChannelConfig({ channelId: "ch1" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.channelId).toBe("ch1");
      }
    });

    it("should return ok: false with errors for invalid config", () => {
      const result = validateChannelConfig({ reconnectDelayMs: 100 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain("reconnectDelayMs");
      }
    });

    it("should format error paths correctly", () => {
      const result = validateChannelConfig({ reconnectDelayMs: 100 });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some(e => e.includes("reconnectDelayMs"))).toBe(true);
      }
    });
  });
});
