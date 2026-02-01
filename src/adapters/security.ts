/**
 * Kakao Channel Security Adapter (Simplified)
 *
 * Relay mode only security handling.
 */

import type { ResolvedKakaoTalkChannel } from "../types.js";

export interface ChannelSecurityDmPolicy {
  policy: "pairing" | "allowlist" | "open" | "disabled";
  allowFrom: string[];
  policyPath: string;
  allowFromPath: string;
  approveHint: string;
  normalizeEntry: (raw: string) => string;
}

export interface SecurityContext {
  account: ResolvedKakaoTalkChannel;
  accountId: string;
  // Legacy names for compatibility
  talkchannel?: ResolvedKakaoTalkChannel;
  talkchannelId?: string;
}

export const securityAdapter = {
  resolveDmPolicy: (ctx: SecurityContext): ChannelSecurityDmPolicy | null => {
    const account = ctx.account ?? ctx.talkchannel;
    if (!account) return null;
    const policy = account.config.dmPolicy ?? "pairing";

    return {
      policy,
      allowFrom: account.config.allowFrom ?? [],
      policyPath: `channels["kakao-talkchannel"].dmPolicy`,
      allowFromPath: `channels["kakao-talkchannel"].allowFrom`,
      approveHint: "openclaw pairing approve kakao-talkchannel <userId>",
      normalizeEntry: (raw: string) =>
        raw.trim().replace(/^(kakao|kakaotalk):/i, "").trim(),
    };
  },

  collectWarnings: (ctx: { account?: ResolvedKakaoTalkChannel; talkchannel?: ResolvedKakaoTalkChannel }): string[] => {
    const account = ctx.account ?? ctx.talkchannel;
    if (!account) return [];
    const warnings: string[] = [];

    if (account.config.dmPolicy === "open") {
      warnings.push(
        "- Kakao DM: dmPolicy='open' allows any user to message. " +
          "Consider 'pairing' or 'allowlist' for production."
      );
    }

    return warnings;
  },
};
