/**
 * Kakao TalkChannel resolution logic
 *
 * Resolves talkchannel configuration from plugin config object.
 * Handles config path: channels["kakao-talkchannel"].talkchannels[talkchannelId]
 * Applies schema defaults during resolution.
 */

import type { ResolvedKakaoTalkChannel } from "../types.js";
import { KakaoTalkChannelConfigSchema } from "./schema.js";

/**
 * Resolve a Kakao TalkChannel from configuration
 *
 * @param cfg - Plugin configuration object
 * @param talkchannelId - TalkChannel identifier
 * @returns Resolved talkchannel with validated config and defaults applied
 * @throws Error if talkchannel not found or config invalid
 */
export function resolveKakaoTalkChannel(
  cfg: unknown,
  talkchannelId: string
): ResolvedKakaoTalkChannel {
  // Navigate config path: channels.kakao.talkchannels[talkchannelId]
  const kakaoConfig = getKakaoChannelConfig(cfg);

  if (!kakaoConfig) {
    throw new Error(
      "Kakao TalkChannel is not configured. " +
      "Please add channels[\"kakao-talkchannel\"] section to your configuration."
    );
  }

  const talkchannels = kakaoConfig.talkchannels as Record<string, unknown> | undefined;
  if (!talkchannels || !(talkchannelId in talkchannels)) {
    throw new Error(
      `Kakao TalkChannel "${talkchannelId}" not found in configuration. ` +
      `Available talkchannels: ${Object.keys(talkchannels ?? {}).join(", ") || "none"}`
    );
  }

  const rawTalkChannelConfig = talkchannels[talkchannelId];

  // Validate and apply defaults using schema
  const validationResult = KakaoTalkChannelConfigSchema.safeParse(rawTalkChannelConfig);

  if (!validationResult.success) {
    const errors = validationResult.error.issues
      .map((issue: { path: (string | number)[]; message: string }) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid Kakao TalkChannel configuration for "${talkchannelId}": ${errors}`
    );
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
    talkchannelId,
    config,
    enabled: config.enabled,
    name: (rawTalkChannelConfig as Record<string, unknown>).name as string | undefined,
    channelId: config.channelId, // May be undefined for relay mode
    mode: config.mode,
    tokenSource,
  };
}

/**
 * List all configured Kakao TalkChannel IDs
 *
 * @param cfg - Plugin configuration object
 * @returns Array of talkchannel IDs, empty array if none configured
 */
export function listKakaoTalkChannelIds(cfg: unknown): string[] {
  const kakaoConfig = getKakaoChannelConfig(cfg);

  if (!kakaoConfig || !kakaoConfig.talkchannels) {
    return [];
  }

  return Object.keys(kakaoConfig.talkchannels);
}

/**
 * Get the default Kakao TalkChannel ID
 *
 * Returns "default" if it exists, otherwise returns the first talkchannel ID.
 *
 * @param cfg - Plugin configuration object
 * @returns Default talkchannel ID
 * @throws Error if no talkchannels configured
 */
export function getDefaultTalkChannelId(cfg: unknown): string {
  const ids = listKakaoTalkChannelIds(cfg);

  if (ids.length === 0) {
    throw new Error(
      "No Kakao TalkChannels configured. " +
      "Please configure at least one talkchannel in channels[\"kakao-talkchannel\"].talkchannels"
    );
  }

  // Prefer "default" if it exists
  if (ids.includes("default")) {
    return "default";
  }

  // Otherwise return first talkchannel
  return ids[0];
}

/**
 * Internal helper: Extract Kakao channel config from plugin config
 *
 * @param cfg - Plugin configuration object
 * @returns Kakao channel config or undefined
 */
function getKakaoChannelConfig(
  cfg: unknown
): Record<string, unknown> | undefined {
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

  return kakao as Record<string, unknown>;
}
