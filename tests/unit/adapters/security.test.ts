/**
 * ChannelSecurityAdapter tests
 *
 * Tests for securityAdapter implementation with 6+ test cases covering:
 * - resolveDmPolicy: resolve policy config from account
 * - normalizeEntry: remove kakao: or kakaotalk: prefix
 * - approveHint: return correct approval command
 * - policyPath & allowFromPath: return correct config paths
 * - collectWarnings: warn on open policy and missing relay token
 * - Edge cases: null policy, empty allowFrom, relay without token
 */
import { describe, it, expect } from "vitest";
import { securityAdapter } from "../../../src/adapters/security";
import type { ResolvedKakaoAccount } from "../../../src/types";

describe("ChannelSecurityAdapter", () => {
  describe("resolveDmPolicy", () => {
    it("should resolve pairing policy with correct paths and normalizer", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "pairing",
          allowFrom: ["user1", "user2"],
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        account,
        accountId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("pairing");
      expect(policy!.allowFrom).toEqual(["user1", "user2"]);
      expect(policy!.policyPath).toBe("channels[\"kakao-talkchannel\"].accounts.default.dmPolicy");
      expect(policy!.allowFromPath).toBe(
        "channels[\"kakao-talkchannel\"].accounts.default.allowFrom"
      );
    });

    it("should resolve allowlist policy with empty allowFrom array", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "secondary",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel456",
          mode: "relay",
          dmPolicy: "allowlist",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        account,
        accountId: "secondary",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("allowlist");
      expect(policy!.allowFrom).toEqual([]);
    });

    it("should resolve open policy", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "test",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel789",
          mode: "direct",
          dmPolicy: "open",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        account,
        accountId: "test",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("open");
    });

    it("should resolve disabled policy", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "disabled",
        enabled: false,
        config: {
          enabled: false,
          channelId: "channel000",
          mode: "direct",
          dmPolicy: "disabled",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        account,
        accountId: "disabled",
      });

      expect(policy).not.toBeNull();
      expect(policy!.policy).toBe("disabled");
    });

    it("should normalize entry by removing kakao: prefix", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "allowlist",
          allowFrom: ["kakao:user123"],
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        account,
        accountId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.normalizeEntry("kakao:user123")).toBe("user123");
      expect(policy!.normalizeEntry("user456")).toBe("user456");
    });

    it("should normalize entry case-insensitively for kakao: prefix", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "allowlist",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        account,
        accountId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.normalizeEntry("KAKAO:user789")).toBe("user789");
      expect(policy!.normalizeEntry("Kakao:user999")).toBe("user999");
    });

    it("should return correct approveHint format", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const policy = securityAdapter.resolveDmPolicy({
        account,
        accountId: "default",
      });

      expect(policy).not.toBeNull();
      expect(policy!.approveHint).toBe("openclaw pairing approve kakao-talkchannel <userId>");
    });
  });

  describe("collectWarnings", () => {
    it("should warn when dmPolicy is open", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "open",
        },
      };

      const warnings = securityAdapter.collectWarnings({ account });

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("dmPolicy='open'");
      expect(warnings[0]).toContain("allows any user to message");
    });

    it("should warn when relay mode without relayToken", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "relay",
          dmPolicy: "pairing",
        },
      };

      const warnings = securityAdapter.collectWarnings({ account });

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("relay mode");
      expect(warnings[0]).toContain("relayToken is not configured");
    });

    it("should warn on both open policy and missing relay token", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "relay",
          dmPolicy: "open",
        },
      };

      const warnings = securityAdapter.collectWarnings({ account });

      expect(warnings.length).toBe(2);
      expect(warnings.some((w) => w.includes("dmPolicy='open'"))).toBe(true);
      expect(warnings.some((w) => w.includes("relayToken"))).toBe(true);
    });

    it("should not warn when relay mode has relayToken", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "relay",
          relayToken: "sk-test-token-123",
          dmPolicy: "pairing",
        },
      };

      const warnings = securityAdapter.collectWarnings({ account });

      expect(warnings.length).toBe(0);
    });

    it("should not warn when direct mode without relayToken", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const warnings = securityAdapter.collectWarnings({ account });

      expect(warnings.length).toBe(0);
    });

    it("should not warn when dmPolicy is pairing or allowlist", () => {
      const accountPairing: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "pairing",
        },
      };

      const accountAllowlist: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: true,
        config: {
          enabled: true,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "allowlist",
        },
      };

      const warningsPairing = securityAdapter.collectWarnings({
        account: accountPairing,
      });
      const warningsAllowlist = securityAdapter.collectWarnings({
        account: accountAllowlist,
      });

      expect(warningsPairing.length).toBe(0);
      expect(warningsAllowlist.length).toBe(0);
    });

    it("should not warn when dmPolicy is disabled", () => {
      const account: ResolvedKakaoAccount = {
        accountId: "default",
        enabled: false,
        config: {
          enabled: false,
          channelId: "channel123",
          mode: "direct",
          dmPolicy: "disabled",
        },
      };

      const warnings = securityAdapter.collectWarnings({ account });

      expect(warnings.length).toBe(0);
    });
  });
});
