/**
 * ChannelConfigAdapter tests
 * 
 * Tests for configAdapter implementation with 6+ test cases covering:
 * - listAccountIds: extract account IDs from config
 * - resolveAccount: resolve account with validation
 * - defaultAccountId: return default or first account
 * - isConfigured: check if account has channelId
 * - isEnabled: check if account is enabled
 * - Edge cases: missing config, empty accounts, disabled accounts
 */
import { describe, it, expect } from "vitest";
import { configAdapter } from "../../../src/adapters/config";

describe("ChannelConfigAdapter", () => {
  describe("listAccountIds", () => {
    it("should return array of account IDs from valid config", () => {
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

      const ids = configAdapter.listAccountIds(cfg);

      expect(ids).toEqual(["default", "secondary"]);
    });

    it("should return empty array when no accounts configured", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const ids = configAdapter.listAccountIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when config is missing kakao channel", () => {
      const cfg = {
        channels: {},
      };

      const ids = configAdapter.listAccountIds(cfg);

      expect(ids).toEqual([]);
    });

    it("should return empty array when config is null or undefined", () => {
      expect(configAdapter.listAccountIds(null)).toEqual([]);
      expect(configAdapter.listAccountIds(undefined)).toEqual([]);
    });
  });

  describe("resolveAccount", () => {
    it("should resolve account with valid config", () => {
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

      const account = configAdapter.resolveAccount(cfg, "default");

      expect(account.accountId).toBe("default");
      expect(account.config.channelId).toBe("channel123");
      expect(account.config.enabled).toBe(true);
      expect(account.enabled).toBe(true);
    });

    it("should throw error when account not found", () => {
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

      expect(() => configAdapter.resolveAccount(cfg, "nonexistent")).toThrow(
        /not found/i
      );
    });

    it("should throw error when config is invalid", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
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

      expect(() => configAdapter.resolveAccount(cfg, "default")).toThrow();
    });
  });

  describe("defaultAccountId", () => {
    it("should return 'default' when it exists", () => {
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

      const id = configAdapter.defaultAccountId(cfg);

      expect(id).toBe("default");
    });

    it("should return first account ID when 'default' does not exist", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
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

      const id = configAdapter.defaultAccountId(cfg);

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

      expect(() => configAdapter.defaultAccountId(cfg)).toThrow(
        /no.*accounts/i
      );
    });
  });

  describe("isConfigured", () => {
    it("should return true when account has channelId", () => {
      const account = {
        accountId: "default",
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(account)).toBe(true);
    });

    it("should return false when account has empty channelId", () => {
      const account = {
        accountId: "default",
        config: {
          enabled: true,
          channelId: "",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(account)).toBe(false);
    });

    it("should return false when account has no channelId", () => {
      const account = {
        accountId: "default",
        config: {
          enabled: true,
          channelId: undefined as any,
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isConfigured(account)).toBe(false);
    });
  });

  describe("isEnabled", () => {
    it("should return true when account is enabled", () => {
      const account = {
        accountId: "default",
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isEnabled(account)).toBe(true);
    });

    it("should return false when account is disabled", () => {
      const account = {
        accountId: "default",
        config: {
          enabled: false,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: false,
      };

      expect(configAdapter.isEnabled(account)).toBe(false);
    });

    it("should return false when config.enabled is false", () => {
      const account = {
        accountId: "default",
        config: {
          enabled: false,
          channelId: "channel123",
          mode: "direct" as const,
          dmPolicy: "pairing" as const,
        },
        enabled: true,
      };

      expect(configAdapter.isEnabled(account)).toBe(false);
    });
  });

  describe("Integration: Full workflow", () => {
    it("should list, resolve, and check status of accounts", () => {
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
      const ids = configAdapter.listAccountIds(cfg);
      expect(ids).toContain("default");
      expect(ids).toContain("secondary");

      // Resolve default account
      const defaultAccount = configAdapter.resolveAccount(cfg, "default");
      expect(configAdapter.isConfigured(defaultAccount)).toBe(true);
      expect(configAdapter.isEnabled(defaultAccount)).toBe(true);

      // Resolve secondary account
      const secondaryAccount = configAdapter.resolveAccount(cfg, "secondary");
      expect(configAdapter.isConfigured(secondaryAccount)).toBe(true);
      expect(configAdapter.isEnabled(secondaryAccount)).toBe(false);

      // Get default account ID
      const defaultId = configAdapter.defaultAccountId(cfg);
      expect(defaultId).toBe("default");
    });
  });
});
