/**
 * Setup Adapter tests (Simplified)
 *
 * Relay mode only - minimal validation.
 */
import { describe, it, expect } from "vitest";
import { setupAdapter, type SetupInput } from "../../../src/adapters/setup";

describe("SetupAdapter (Simplified)", () => {
  describe("resolveTalkChannelId", () => {
    it("should always return 'default'", () => {
      const result = setupAdapter.resolveTalkChannelId({ talkchannelId: "MyAccount" });
      expect(result).toBe("default");
    });

    it("should return 'default' when talkchannelId is undefined", () => {
      const result = setupAdapter.resolveTalkChannelId({ talkchannelId: undefined });
      expect(result).toBe("default");
    });

    it("should return 'default' when talkchannelId is empty string", () => {
      const result = setupAdapter.resolveTalkChannelId({ talkchannelId: "" });
      expect(result).toBe("default");
    });
  });

  describe("applyTalkChannelName", () => {
    it("should add name to channel config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            channelId: "ch123",
          },
        },
      };

      const result = setupAdapter.applyTalkChannelName({
        cfg,
        talkchannelId: "default",
        name: "My Kakao Bot",
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.name).toBe("My Kakao Bot");
    });

    it("should preserve existing config when adding name", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            channelId: "ch123",
            dmPolicy: "pairing",
          },
        },
      };

      const result = setupAdapter.applyTalkChannelName({
        cfg,
        talkchannelId: "default",
        name: "Updated Name",
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.channelId).toBe("ch123");
      expect(kakao?.enabled).toBe(true);
      expect(kakao?.name).toBe("Updated Name");
    });

    it("should return config unchanged when name is undefined", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            channelId: "ch123",
          },
        },
      };

      const result = setupAdapter.applyTalkChannelName({
        cfg,
        talkchannelId: "default",
        name: undefined,
      });

      expect(result).toEqual(cfg);
    });

    it("should return config unchanged when name is empty string", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            enabled: true,
            channelId: "ch123",
          },
        },
      };

      const result = setupAdapter.applyTalkChannelName({
        cfg,
        talkchannelId: "default",
        name: "",
      });

      expect(result).toEqual(cfg);
    });
  });

  describe("validateInput", () => {
    it("should return null for empty input (relay mode has no required fields)", () => {
      const input: SetupInput = {};

      const error = setupAdapter.validateInput({
        talkchannelId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should return null for input with channelId", () => {
      const input: SetupInput = {
        channelId: "ch123",
      };

      const error = setupAdapter.validateInput({
        talkchannelId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should return null for input with relayUrl only", () => {
      const input: SetupInput = {
        relayUrl: "https://relay.example.com",
      };

      const error = setupAdapter.validateInput({
        talkchannelId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should return null for input with relayToken only", () => {
      const input: SetupInput = {
        relayToken: "token123",
      };

      const error = setupAdapter.validateInput({
        talkchannelId: "default",
        input,
      });

      expect(error).toBeNull();
    });

    it("should return null for full input", () => {
      const input: SetupInput = {
        channelId: "ch123",
        relayUrl: "https://relay.example.com",
        relayToken: "token123",
        name: "My Bot",
      };

      const error = setupAdapter.validateInput({
        talkchannelId: "default",
        input,
      });

      expect(error).toBeNull();
    });
  });

  describe("applyTalkChannelConfig", () => {
    it("should merge config into channels.kakao-talkchannel", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {},
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        relayUrl: "https://relay.example.com",
        relayToken: "token123",
      };

      const result = setupAdapter.applyTalkChannelConfig({
        cfg,
        talkchannelId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.enabled).toBe(true);
      expect(kakao?.channelId).toBe("ch123");
      expect(kakao?.relayUrl).toBe("https://relay.example.com");
      expect(kakao?.relayToken).toBe("token123");
      expect(kakao?.dmPolicy).toBe("pairing");
    });

    it("should apply sessionToken when provided", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {},
        },
      };

      const input: SetupInput = {
        sessionToken: "session123",
      };

      const result = setupAdapter.applyTalkChannelConfig({
        cfg,
        talkchannelId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.sessionToken).toBe("session123");
    });

    it("should include name in config when provided", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {},
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
        name: "My Kakao Bot",
      };

      const result = setupAdapter.applyTalkChannelConfig({
        cfg,
        talkchannelId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.name).toBe("My Kakao Bot");
    });

    it("should preserve existing dmPolicy", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {
            dmPolicy: "open",
          },
        },
      };

      const input: SetupInput = {
        channelId: "ch123",
      };

      const result = setupAdapter.applyTalkChannelConfig({
        cfg,
        talkchannelId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.dmPolicy).toBe("open");
    });

    it("should handle missing channels structure", () => {
      const cfg = {};

      const input: SetupInput = {
        channelId: "ch123",
      };

      const result = setupAdapter.applyTalkChannelConfig({
        cfg,
        talkchannelId: "default",
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.channelId).toBe("ch123");
      expect(kakao?.enabled).toBe(true);
    });
  });

  describe("Integration: Full setup workflow", () => {
    it("should resolve ID, validate input, and apply config", () => {
      const cfg = {
        channels: {
          "kakao-talkchannel": {},
        },
      };

      // Step 1: Resolve talkchannel ID (always default)
      const talkchannelId = setupAdapter.resolveTalkChannelId({
        talkchannelId: "any-id",
      });
      expect(talkchannelId).toBe("default");

      // Step 2: Validate input (always valid for relay mode)
      const input: SetupInput = {
        channelId: "ch123",
        relayUrl: "https://relay.example.com",
        relayToken: "secret-token",
        name: "Relay Bot",
      };

      const validationError = setupAdapter.validateInput({
        talkchannelId,
        input,
      });
      expect(validationError).toBeNull();

      // Step 3: Apply config
      const result = setupAdapter.applyTalkChannelConfig({
        cfg,
        talkchannelId,
        input,
      });

      const resultCfg = result as Record<string, unknown>;
      const kakao = (resultCfg.channels as Record<string, unknown>)?.["kakao-talkchannel"] as Record<string, unknown>;

      expect(kakao?.channelId).toBe("ch123");
      expect(kakao?.relayUrl).toBe("https://relay.example.com");
      expect(kakao?.relayToken).toBe("secret-token");
      expect(kakao?.name).toBe("Relay Bot");
      expect(kakao?.enabled).toBe(true);
    });
  });
});
