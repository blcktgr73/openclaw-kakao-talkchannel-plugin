/**
 * ChannelSecurityAdapter tests (Simplified)
 *
 * Relay mode only.
 */
import { describe, it, expect } from "vitest";
import { securityAdapter } from "../../../src/adapters/security";
import type { ResolvedKakaoTalkChannel } from "../../../src/types";

describe("ChannelSecurityAdapter (Simplified)", () => {
  describe("resolveDmPolicy", () => {
    it("should resolve pairing policy with correct paths", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "pairing",
          allowFrom: ["user1", "user2"],
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        talkchannel,
        talkchannelId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("pairing");
      expect(policy!.allowFrom).toEqual(["user1", "user2"]);
      expect(policy!.policyPath).toBe(`channels["kakao-talkchannel"].dmPolicy`);
      expect(policy!.allowFromPath).toBe(`channels["kakao-talkchannel"].allowFrom`);
    });

    it("should resolve allowlist policy with empty allowFrom array", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel456",
          dmPolicy: "allowlist",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        talkchannel,
        talkchannelId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("allowlist");
      expect(policy!.allowFrom).toEqual([]);
    });

    it("should resolve open policy", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel789",
          dmPolicy: "open",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        talkchannel,
        talkchannelId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("open");
    });

    it("should resolve disabled policy", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: false,
        config: {
          enabled: false,
          channelId: "channel000",
          dmPolicy: "disabled",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        talkchannel,
        talkchannelId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("disabled");
    });

    it("should normalize entry by removing kakao: prefix", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "allowlist",
          allowFrom: ["kakao:user123"],
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        talkchannel,
        talkchannelId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.normalizeEntry("kakao:user123")).toBe("user123");
      expect(policy!.normalizeEntry("user456")).toBe("user456");
    });

    it("should normalize entry case-insensitively for kakao: prefix", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "allowlist",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        talkchannel,
        talkchannelId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.normalizeEntry("KAKAO:user789")).toBe("user789");
      expect(policy!.normalizeEntry("Kakao:user999")).toBe("user999");
    });

    it("should return correct approveHint format", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "pairing",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        talkchannel,
        talkchannelId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.approveHint).toBe("openclaw pairing approve kakao-talkchannel <userId>");
    });
  });

  describe("collectWarnings", () => {
    it("should warn when dmPolicy is open", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "open",
        },
      };

      const warnings = securityAdapter.collectWarnings({ talkchannel });

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("dmPolicy='open'");
      expect(warnings[0]).toContain("allows any user to message");
    });

    it("should not warn when no token (session can be auto-created)", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "pairing",
          // No relayToken or sessionToken
        },
      };

      const warnings = securityAdapter.collectWarnings({ talkchannel });

      expect(warnings.length).toBe(0);
    });

    it("should not warn when relayToken is set", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          relayToken: "sk-test-token-123",
          dmPolicy: "pairing",
        },
      };

      const warnings = securityAdapter.collectWarnings({ talkchannel });

      expect(warnings.length).toBe(0);
    });

    it("should not warn when sessionToken is set", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          sessionToken: "session-123",
          dmPolicy: "pairing",
        },
      };

      const warnings = securityAdapter.collectWarnings({ talkchannel });

      expect(warnings.length).toBe(0);
    });

    it("should not warn when dmPolicy is pairing or allowlist", () => {
      const talkchannelPairing: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "pairing",
        },
      };

      const talkchannelAllowlist: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          dmPolicy: "allowlist",
        },
      };

      const warningsPairing = securityAdapter.collectWarnings({
        talkchannel: talkchannelPairing,
      });
      const warningsAllowlist = securityAdapter.collectWarnings({
        talkchannel: talkchannelAllowlist,
      });

      expect(warningsPairing.length).toBe(0);
      expect(warningsAllowlist.length).toBe(0);
    });

    it("should not warn when dmPolicy is disabled", () => {
      const talkchannel: ResolvedKakaoTalkChannel = {
        talkchannelId: "default",
        enabled: false,
        config: {
          enabled: false,
          channelId: "channel123",
          dmPolicy: "disabled",
        },
      };

      const warnings = securityAdapter.collectWarnings({ talkchannel });

      expect(warnings.length).toBe(0);
    });
  });
});
