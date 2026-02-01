/**
 * Kakao Channel Security Adapter
 *
 * Handles DM policy resolution and security warnings for Kakao accounts.
 */

import type { ResolvedKakaoAccount } from "../types.js";

export interface ChannelSecurityDmPolicy {
  policy: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom: string[];
  policyPath: string;
  allowFromPath: string;
  approveHint: string;
  normalizeEntry: (raw: string) => string;
}

export interface SecurityContext {
  account: ResolvedKakaoAccount;
  accountId: string;
}

export const securityAdapter = {
  resolveDmPolicy: (ctx: SecurityContext): ChannelSecurityDmPolicy | null => {
    const { account, accountId } = ctx;
    const policy = account.config.dmPolicy ?? "pairing";

    return {
      policy,
      allowFrom: account.config.allowFrom ?? [],
      policyPath: `channels["kakao-talkchannel"].accounts.${accountId}.dmPolicy`,
      allowFromPath: `channels["kakao-talkchannel"].accounts.${accountId}.allowFrom`,
      approveHint: "openclaw pairing approve kakao-talkchannel <userId>",
      normalizeEntry: (raw: string) =>
        raw.trim().replace(/^(kakao|kakaotalk):/i, "").trim(),
    };
  },

  collectWarnings: (ctx: { account: ResolvedKakaoAccount }): string[] => {
    const { account } = ctx;
    const warnings: string[] = [];

    if (account.config.dmPolicy === "open") {
      warnings.push(
        "- Kakao DM: dmPolicy='open' allows any user to message. " +
          "Consider 'pairing' or 'allowlist' for production."
      );
    }

    if (account.config.mode === "relay" && !account.config.relayToken) {
      warnings.push(
        "- Kakao relay mode: relayToken is not configured. " +
          "Messages cannot be received without authentication."
      );
    }

    return warnings;
  },
};
