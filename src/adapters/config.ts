/**
 * Kakao Channel Config Adapter (Simplified)
 *
 * Single channel, relay mode only.
 * Internally uses talkchannelId='default' for future extensibility.
 */

import type { ResolvedKakaoTalkChannel, KakaoChannelConfig } from "../types.js";
import { KakaoChannelConfigSchema } from "../config/schema.js";

/**
 * ChannelConfigAdapter interface
 * Uses OpenClaw standard naming: accountId, resolveAccount, etc.
 */
export interface ChannelConfigAdapter<T> {
  listAccountIds: (cfg: unknown) => string[];
  resolveAccount: (cfg: unknown, accountId: string) => T;
  defaultAccountId: (cfg: unknown) => string;
  isConfigured: (account: T) => boolean;
  isEnabled: (account: T) => boolean;
}

/**
 * Extract Kakao channel config from plugin config
 * Returns empty object if not configured (will use schema defaults)
 */
function getKakaoChannelConfig(cfg: unknown): KakaoChannelConfig {
  if (!cfg || typeof cfg !== "object") {
    return {} as KakaoChannelConfig;
  }

  const configObj = cfg as Record<string, unknown>;
  const channels = configObj.channels;

  if (!channels || typeof channels !== "object") {
    return {} as KakaoChannelConfig;
  }

  const channelsObj = channels as Record<string, unknown>;
  const kakao = channelsObj["kakao-talkchannel"];

  if (!kakao || typeof kakao !== "object") {
    return {} as KakaoChannelConfig;
  }

  return kakao as KakaoChannelConfig;
}

/**
 * Resolve Kakao TalkChannel from configuration
 * Uses schema defaults if no config provided
 */
function resolveKakaoTalkChannel(cfg: unknown, _talkchannelId: string): ResolvedKakaoTalkChannel {
  const rawConfig = getKakaoChannelConfig(cfg);

  // Validate and apply defaults using schema (empty object gets all defaults)
  const validationResult = KakaoChannelConfigSchema.safeParse(rawConfig);

  if (!validationResult.success) {
    const errors = validationResult.error.issues
      .map((issue: { path: (string | number)[]; message: string }) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid Kakao TalkChannel configuration: ${errors}`);
  }

  const config = validationResult.data;

  // Determine token source
  let tokenSource: "config" | "env" | "session" | "none" = "none";
  if (config.sessionToken) {
    tokenSource = "session";
  } else if (config.relayToken) {
    tokenSource = "config";
  } else if (process.env.OPENCLAW_TALKCHANNEL_RELAY_TOKEN) {
    tokenSource = "env";
  }

  return {
    talkchannelId: "default", // Always "default" for single channel
    config,
    enabled: config.enabled,
    name: (rawConfig as unknown as Record<string, unknown>).name as string | undefined,
    channelId: config.channelId,
    tokenSource,
  };
}

/**
 * Kakao channel configuration adapter (simplified)
 * Uses OpenClaw standard naming for compatibility
 */
export const configAdapter: ChannelConfigAdapter<ResolvedKakaoTalkChannel> = {
  listAccountIds: (_cfg) => {
    // Always return single channel (uses defaults if no config)
    return ["default"];
  },

  resolveAccount: (cfg, accountId) => {
    return resolveKakaoTalkChannel(cfg, accountId);
  },

  defaultAccountId: (_cfg) => {
    return "default";
  },

  isConfigured: (account) => {
    // For relay mode: always configured (can auto-create session)
    return Boolean(
      account.config.sessionToken ||
      account.config.relayToken ||
      process.env.OPENCLAW_TALKCHANNEL_RELAY_TOKEN ||
      true // Can always auto-create session
    );
  },

  isEnabled: (account) => {
    return account.config.enabled;
  },
};
