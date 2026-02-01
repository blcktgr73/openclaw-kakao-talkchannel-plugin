/**
 * Account resolution tests
 * 
 * Tests for resolveKakaoAccount, listKakaoAccountIds, and getDefaultAccountId
 */
import { describe, it, expect } from "vitest";
import {
  resolveKakaoAccount,
  listKakaoAccountIds,
  getDefaultAccountId,
} from "../../../src/config/accounts";

describe("Account Resolution", () => {
  describe("resolveKakaoAccount", () => {
    it("should resolve account from valid config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
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

      const account = resolveKakaoAccount(cfg, "default");

      expect(account.accountId).toBe("default");
      expect(account.config.channelId).toBe("channel123");
      expect(account.config.enabled).toBe(true);
      expect(account.enabled).toBe(true);
    });

    it("should apply schema defaults when resolving", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: {
                channelId: "channel123",
              },
            },
          },
        },
      };

      const account = resolveKakaoAccount(cfg, "default");

      expect(account.config.enabled).toBe(true);
      expect(account.config.mode).toBe("direct");
      expect(account.config.dmPolicy).toBe("pairing");
      expect(account.config.webhookPath).toBe("/kakao-talkchannel/webhook");
        expect(account.config.reconnectDelayMs).toBe(1000);
        expect(account.config.maxReconnectDelayMs).toBe(30000);
      expect(account.config.callbackTimeoutMs).toBe(55000);
    });

    it("should throw error when account not found", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      expect(() => resolveKakaoAccount(cfg, "missing")).toThrow(
        /account.*not found/i
      );
    });

    it("should throw error when channels.kakao-talkchannel missing", () => {
      const cfg = {
        channels: {},
      };

      expect(() => resolveKakaoAccount(cfg, "default")).toThrow(
        /kakao.*not configured/i
      );
    });

    it("should throw error when channels missing", () => {
      const cfg = {};

      expect(() => resolveKakaoAccount(cfg, "default")).toThrow(
        /kakao.*not configured/i
      );
    });

    it("should resolve relay mode account with all settings", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              relay_account: {
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

      const account = resolveKakaoAccount(cfg, "relay_account");

      expect(account.accountId).toBe("relay_account");
      expect(account.config.mode).toBe("relay");
      expect(account.config.relayUrl).toBe("https://relay.example.com");
      expect(account.config.relayToken).toBe("secret_token");
      expect(account.config.reconnectDelayMs).toBe(2000);
      expect(account.config.maxReconnectDelayMs).toBe(15000);
    });

    it("should set enabled field based on config.enabled", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              disabled: {
                enabled: false,
                channelId: "ch1",
              },
            },
          },
        },
      };

      const account = resolveKakaoAccount(cfg, "disabled");

      expect(account.enabled).toBe(false);
      expect(account.config.enabled).toBe(false);
    });

    it("should include optional name field when present", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              named: {
                enabled: true,
                channelId: "ch1",
                name: "My Kakao Bot",
              },
            },
          },
        },
      };

      const account = resolveKakaoAccount(cfg, "named");

      expect(account.name).toBe("My Kakao Bot");
    });

    it("should validate config and throw on invalid data", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              invalid: {
                channelId: "",
              },
            },
          },
        },
      };

      expect(() => resolveKakaoAccount(cfg, "invalid")).toThrow();
    });
  });

  describe("listKakaoAccountIds", () => {
    it("should return list of account IDs", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: { channelId: "ch1" },
              secondary: { channelId: "ch2" },
              tertiary: { channelId: "ch3" },
            },
          },
        },
      };

      const ids = listKakaoAccountIds(cfg);

      expect(ids).toContain("default");
      expect(ids).toContain("secondary");
      expect(ids).toContain("tertiary");
      expect(ids.length).toBe(3);
    });

    it("should return empty array when no accounts configured", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const ids = listKakaoAccountIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when kakao not configured", () => {
      const cfg = {
        channels: {},
      };

      const ids = listKakaoAccountIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when channels missing", () => {
      const cfg = {};

      const ids = listKakaoAccountIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should handle unknown config structure gracefully", () => {
      const cfg = null;

      const ids = listKakaoAccountIds(cfg);

      expect(ids).toEqual([]);
    });
  });

  describe("getDefaultAccountId", () => {
    it("should return 'default' when it exists", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: { channelId: "ch1" },
              secondary: { channelId: "ch2" },
            },
          },
        },
      };

      const id = getDefaultAccountId(cfg);

      expect(id).toBe("default");
    });

    it("should return first account ID when 'default' does not exist", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              primary: { channelId: "ch1" },
              secondary: { channelId: "ch2" },
            },
          },
        },
      };

      const id = getDefaultAccountId(cfg);

      expect(id).toBe("primary");
    });

    it("should throw error when no accounts configured", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      expect(() => getDefaultAccountId(cfg)).toThrow(
        /no.*account.*configured/i
      );
    });

    it("should throw error when kakao not configured", () => {
      const cfg = {
        channels: {},
      };

      expect(() => getDefaultAccountId(cfg)).toThrow(
        /no.*account.*configured/i
      );
    });

    it("should throw error when channels missing", () => {
      const cfg = {};

      expect(() => getDefaultAccountId(cfg)).toThrow(
        /no.*account.*configured/i
      );
    });
  });
});
