/**
 * Kakao Channel Security Adapter
 *
 * Handles DM policy resolution and security warnings for Kakao TalkChannels.
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
    const { talkchannel, talkchannelId } = ctx;
    const policy = talkchannel.config.dmPolicy ?? "pairing";

    return {
      policy,
      allowFrom: talkchannel.config.allowFrom ?? [],
      policyPath: `channels["kakao-talkchannel"].talkchannels.${talkchannelId}.dmPolicy`,
      allowFromPath: `channels["kakao-talkchannel"].talkchannels.${talkchannelId}.allowFrom`,
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

    if (talkchannel.config.mode === "relay" && !talkchannel.config.relayToken) {
      warnings.push(
        "- Kakao relay mode: relayToken is not configured. " +
          "Messages cannot be received without authentication."
      );
    }

    return warnings;
  },
};
