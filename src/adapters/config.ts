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
 */
export interface ChannelConfigAdapter<T> {
  listTalkChannelIds: (cfg: unknown) => string[];
  resolveTalkChannel: (cfg: unknown, talkchannelId: string) => T;
  defaultTalkChannelId: (cfg: unknown) => string;
  isConfigured: (talkchannel: T) => boolean;
  isEnabled: (talkchannel: T) => boolean;
}

/**
 * Extract Kakao channel config from plugin config
 */
function getKakaoChannelConfig(cfg: unknown): KakaoChannelConfig | undefined {
  if (!cfg || typeof cfg !== "object") {
    return undefined;
  }

  const configObj = cfg as Record<string, unknown>;
  const channels = configObj.channels;

  if (!channels || typeof channels !== "object") {
    return undefined;
  }

  const channelsObj = channels as Record<string, unknown>;
  const kakao = channelsObj["kakao-talkchannel"];

  if (!kakao || typeof kakao !== "object") {
    return undefined;
  }

  return kakao as KakaoChannelConfig;
}

/**
 * Resolve Kakao TalkChannel from configuration
 */
function resolveKakaoTalkChannel(cfg: unknown, _talkchannelId: string): ResolvedKakaoTalkChannel {
  const rawConfig = getKakaoChannelConfig(cfg);

  if (!rawConfig) {
    throw new Error(
      "Kakao TalkChannel is not configured. " +
      "Please add channels[\"kakao-talkchannel\"] section to your configuration."
    );
  }

  // Validate and apply defaults using schema
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
 */
export const configAdapter: ChannelConfigAdapter<ResolvedKakaoTalkChannel> = {
  listTalkChannelIds: (cfg) => {
    try {
      const kakaoConfig = getKakaoChannelConfig(cfg);
      if (!kakaoConfig) {
        return [];
      }
      return ["default"]; // Always single channel
    } catch {
      return [];
    }
  },

  resolveTalkChannel: (cfg, talkchannelId) => {
    return resolveKakaoTalkChannel(cfg, talkchannelId);
  },

  defaultTalkChannelId: (cfg) => {
    const kakaoConfig = getKakaoChannelConfig(cfg);
    if (!kakaoConfig) {
      throw new Error(
        "No Kakao TalkChannel configured. " +
        "Please add channels[\"kakao-talkchannel\"] section to your configuration."
      );
    }
    return "default"; // Always "default"
  },

  isConfigured: (talkchannel) => {
    // For relay mode: always configured (can auto-create session)
    return Boolean(
      talkchannel.config.sessionToken ||
      talkchannel.config.relayToken ||
      process.env.OPENCLAW_TALKCHANNEL_RELAY_TOKEN ||
      true // Can always auto-create session
    );
  },

  isEnabled: (talkchannel) => {
    return talkchannel.config.enabled;
  },
};
