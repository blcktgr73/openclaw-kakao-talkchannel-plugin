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
  talkchannel: ResolvedKakaoTalkChannel;
  talkchannelId: string;
}

export const securityAdapter = {
  resolveDmPolicy: (ctx: SecurityContext): ChannelSecurityDmPolicy | null => {
    const { talkchannel } = ctx;
    const policy = talkchannel.config.dmPolicy ?? "pairing";

    return {
      policy,
      allowFrom: talkchannel.config.allowFrom ?? [],
      policyPath: `channels["kakao-talkchannel"].dmPolicy`,
      allowFromPath: `channels["kakao-talkchannel"].allowFrom`,
      approveHint: "openclaw pairing approve kakao-talkchannel <userId>",
      normalizeEntry: (raw: string) =>
        raw.trim().replace(/^(kakao|kakaotalk):/i, "").trim(),
    };
  },

  collectWarnings: (ctx: { talkchannel: ResolvedKakaoTalkChannel }): string[] => {
    const { talkchannel } = ctx;
    const warnings: string[] = [];

    if (talkchannel.config.dmPolicy === "open") {
      warnings.push(
        "- Kakao DM: dmPolicy='open' allows any user to message. " +
          "Consider 'pairing' or 'allowlist' for production."
      );
    }

    if (!talkchannel.config.relayToken && !talkchannel.config.sessionToken) {
      // Not a warning in simplified mode - session can be auto-created
    }

    return warnings;
  },
};
