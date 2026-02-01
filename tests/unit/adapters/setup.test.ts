/**
 * Setup Adapter tests
 *
 * Tests for setupAdapter implementation with 5+ test cases covering:
 * - resolveAccountId: normalize and default accountId
 * - applyAccountName: merge name into account config
 * - validateInput: validate required fields based on mode
 * - applyAccountConfig: merge input into channels["kakao-talkchannel"].accounts[accountId]
 * - Edge cases: missing fields, different modes, empty strings
 */
import { describe, it, expect } from "vitest";
import { setupAdapter, type SetupInput } from "../../../src/adapters/setup";

describe("SetupAdapter", () => {
  describe("resolveAccountId", () => {
    it("should return normalized accountId when provided", () => {
      const result = setupAdapter.resolveAccountId({ accountId: "MyAccount" });
      expect(result).toBe("myaccount");
    });

    it("should trim whitespace from accountId", () => {
      const result = setupAdapter.resolveAccountId({ accountId: "  test  " });
      expect(result).toBe("test");
    });

    it("should return 'default' when accountId is undefined", () => {
      const result = setupAdapter.resolveAccountId({ accountId: undefined });
      expect(result).toBe("default");
    });

    it("should return 'default' when accountId is empty string", () => {
      const result = setupAdapter.resolveAccountId({ accountId: "" });
      expect(result).toBe("default");
    });

    it("should return 'default' when accountId is whitespace only", () => {
      const result = setupAdapter.resolveAccountId({ accountId: "   " });
      expect(result).toBe("default");
    });

    it("should handle mixed case with special characters", () => {
      const result = setupAdapter.resolveAccountId({ accountId: "Test-Account_123" });
      expect(result).toBe("test-account_123");
    });
  });

  describe("applyAccountName", () => {
    it("should add name to account config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: {
                enabled: true,
                channelId: "ch123",
                mode: "direct" as const,
              },
            },
          },
        },
      };

      const result = setupAdapter.applyAccountName({
        cfg,
        accountId: "default",
        name: "My Kakao Bot",
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.name).toBe("My Kakao Bot");
    });

    it("should preserve existing account config when adding name", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: {
                enabled: true,
                channelId: "ch123",
                mode: "direct" as const,
                dmPolicy: "pairing" as const,
              },
            },
          },
        },
      };

      const result = setupAdapter.applyAccountName({
        cfg,
        accountId: "default",
        name: "Updated Name",
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.channelId).toBe("ch123");
      expect(defaultAccount?.enabled).toBe(true);
      expect(defaultAccount?.name).toBe("Updated Name");
    });

    it("should return config unchanged when name is undefined", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: {
                enabled: true,
                channelId: "ch123",
              },
            },
          },
        },
      };

      const result = setupAdapter.applyAccountName({
        cfg,
        accountId: "default",
        name: undefined,
      });

      expect(result).toEqual(cfg);
    });

    it("should return config unchanged when name is empty string", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: {
                enabled: true,
                channelId: "ch123",
              },
            },
          },
        },
      };

      const result = setupAdapter.applyAccountName({
        cfg,
        accountId: "default",
        name: "",
      });

      expect(result).toEqual(cfg);
    });

    it("should create account entry if it does not exist", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const result = setupAdapter.applyAccountName({
        cfg,
        accountId: "newaccount",
        name: "New Account",
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const newAccount = accounts?.newaccount as Record<string, unknown>;

      expect(newAccount?.name).toBe("New Account");
    });
  });

  describe("validateInput", () => {
    it("should return error when channelId is missing in direct mode", () => {
      const input: SetupInput = {
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBe("channelId is required for direct mode");
    });

    it("should return error when channelId is empty string in direct mode", () => {
      const input: SetupInput = {
        channelId: "",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBe("channelId is required for direct mode");
    });

    it("should allow relay mode without relayUrl (uses default)", () => {
      const input: SetupInput = {
        mode: "relay",
        relayToken: "token123",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should allow relay mode without relayToken (auto-creates session)", () => {
      const input: SetupInput = {
        mode: "relay",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should allow relay mode without channelId", () => {
      const input: SetupInput = {
        mode: "relay",
        relayToken: "token123",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should return error when direct mode missing publicWebhookUrl", () => {
      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBe("publicWebhookUrl is required for direct mode");
    });

    it("should return null when direct mode has all required fields", () => {
      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should return null when relay mode has all required fields", () => {
      const input: SetupInput = {
        channelId: "ch123",
        mode: "relay",
        relayUrl: "https://relay.example.com",
        relayToken: "token123",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should default to direct mode when mode is undefined", () => {
      const input: SetupInput = {
        channelId: "ch123",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should accept optional name field", () => {
      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
        name: "My Bot",
      };

      const error = setupAdapter.validateInput({
        accountId: "default",
        input,
      });

      expect(error).toBeNull();
    });
  });

  describe("applyAccountConfig", () => {
    it("should merge direct mode config into channels.kakao-talkchannel.accounts", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.enabled).toBe(true);
      expect(defaultAccount?.channelId).toBe("ch123");
      expect(defaultAccount?.mode).toBe("direct");
      expect(defaultAccount?.publicWebhookUrl).toBe(
        "https://example.com/webhook"
      );
      expect(defaultAccount?.dmPolicy).toBe("pairing");
    });

    it("should merge relay mode config into channels.kakao-talkchannel.accounts", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        mode: "relay",
        relayUrl: "https://relay.example.com",
        relayToken: "token123",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.enabled).toBe(true);
      expect(defaultAccount?.channelId).toBe("ch123");
      expect(defaultAccount?.mode).toBe("relay");
      expect(defaultAccount?.relayUrl).toBe("https://relay.example.com");
      expect(defaultAccount?.relayToken).toBe("token123");
      expect(defaultAccount?.dmPolicy).toBe("pairing");
    });

    it("should default to direct mode when mode is undefined", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.mode).toBe("direct");
    });

    it("should include name in config when provided", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
        name: "My Kakao Bot",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.name).toBe("My Kakao Bot");
    });

    it("should preserve existing accounts when adding new one", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              existing: {
                enabled: true,
                channelId: "ch456",
                mode: "direct" as const,
                dmPolicy: "open" as const,
              },
            },
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;

      expect((accounts?.existing as Record<string, unknown>)?.channelId).toBe(
        "ch456"
      );
      expect((accounts?.default as Record<string, unknown>)?.channelId).toBe(
        "ch123"
      );
    });

    it("should overwrite existing account config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {
              default: {
                enabled: false,
                channelId: "ch456",
                mode: "relay" as const,
                dmPolicy: "disabled" as const,
              },
            },
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.enabled).toBe(true);
      expect(defaultAccount?.channelId).toBe("ch123");
      expect(defaultAccount?.mode).toBe("direct");
    });

    it("should enable kakao-talkchannel channel when applying config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: false,
            accounts: {},
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)
        ?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.enabled).toBe(true);
    });

    it("should handle missing channels structure", () => {
      const cfg = {};

      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
      };

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const defaultAccount = accounts?.default as Record<string, unknown>;

      expect(defaultAccount?.channelId).toBe("ch123");
    });
  });

  describe("Integration: Full setup workflow", () => {
    it("should resolve account ID, validate input, and apply config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      // Step 1: Resolve account ID
      const accountId = setupAdapter.resolveAccountId({
        accountId: "  MyAccount  ",
      });
      expect(accountId).toBe("myaccount");

      // Step 2: Validate input
      const input: SetupInput = {
        channelId: "ch123",
        mode: "direct",
        publicWebhookUrl: "https://example.com/webhook",
        name: "My Bot",
      };

      const validationError = setupAdapter.validateInput({
        accountId,
        input,
      });
      expect(validationError).toBeNull();

      // Step 3: Apply config
      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId,
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const account = accounts?.myaccount as Record<string, unknown>;

      expect(account?.channelId).toBe("ch123");
      expect(account?.mode).toBe("direct");
      expect(account?.name).toBe("My Bot");
      expect(account?.enabled).toBe(true);
    });

    it("should handle relay mode setup workflow", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            accounts: {},
          },
        },
      };

      const accountId = setupAdapter.resolveAccountId({
        accountId: "relay-account",
      });

      const input: SetupInput = {
        channelId: "ch456",
        mode: "relay",
        relayUrl: "https://relay.example.com",
        relayToken: "secret-token",
        name: "Relay Bot",
      };

      const validationError = setupAdapter.validateInput({
        accountId,
        input,
      });
      expect(validationError).toBeNull();

      const result = setupAdapter.applyAccountConfig({
        cfg,
        accountId,
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const accounts = (
        (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<
          string,
          unknown
        >
      )?.accounts as Record<string, unknown>;
      const account = accounts?.[accountId] as Record<string, unknown>;

      expect(account?.mode).toBe("relay");
      expect(account?.relayUrl).toBe("https://relay.example.com");
      expect(account?.relayToken).toBe("secret-token");
    });
  });
});
