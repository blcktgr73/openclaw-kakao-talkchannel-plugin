/**
 * Kakao account resolution logic
 *
 * Resolves account configuration from plugin config object.
 * Handles config path: channels["kakao-talkchannel"].accounts[accountId]
 * Applies schema defaults during resolution.
 */

import type { ResolvedKakaoAccount } from "../types.js";
import { KakaoAccountConfigSchema } from "./schema.js";

/**
 * Resolve a Kakao account from configuration
 * 
 * @param cfg - Plugin configuration object
 * @param accountId - Account identifier
 * @returns Resolved account with validated config and defaults applied
 * @throws Error if account not found or config invalid
 */
export function resolveKakaoAccount(
  cfg: unknown,
  accountId: string
): ResolvedKakaoAccount {
  // Navigate config path: channels.kakao.accounts[accountId]
  const kakaoConfig = getKakaoChannelConfig(cfg);
  
  if (!kakaoConfig) {
    throw new Error(
      "Kakao TalkChannel is not configured. " +
      "Please add channels[\"kakao-talkchannel\"] section to your configuration."
    );
  }
  
  const accounts = kakaoConfig.accounts as Record<string, unknown> | undefined;
  if (!accounts || !(accountId in accounts)) {
    throw new Error(
      `Kakao account "${accountId}" not found in configuration. ` +
      `Available accounts: ${Object.keys(accounts ?? {}).join(", ") || "none"}`
    );
  }

  const rawAccountConfig = accounts[accountId];

  // Validate and apply defaults using schema
  const validationResult = KakaoAccountConfigSchema.safeParse(rawAccountConfig);
  
  if (!validationResult.success) {
    const errors = validationResult.error.issues
      .map((issue: { path: (string | number)[]; message: string }) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid Kakao account configuration for "${accountId}": ${errors}`
    );
  }

  const config = validationResult.data;

  return {
    accountId,
    config,
    enabled: config.enabled,
    name: (rawAccountConfig as Record<string, unknown>).name as string | undefined,
    channelId: config.channelId,
    mode: config.mode,
    tokenSource: config.relayToken ? "config" : "none",
  };
}

/**
 * List all configured Kakao account IDs
 * 
 * @param cfg - Plugin configuration object
 * @returns Array of account IDs, empty array if none configured
 */
export function listKakaoAccountIds(cfg: unknown): string[] {
  const kakaoConfig = getKakaoChannelConfig(cfg);
  
  if (!kakaoConfig || !kakaoConfig.accounts) {
    return [];
  }

  return Object.keys(kakaoConfig.accounts);
}

/**
 * Get the default Kakao account ID
 * 
 * Returns "default" if it exists, otherwise returns the first account ID.
 * 
 * @param cfg - Plugin configuration object
 * @returns Default account ID
 * @throws Error if no accounts configured
 */
export function getDefaultAccountId(cfg: unknown): string {
  const ids = listKakaoAccountIds(cfg);

  if (ids.length === 0) {
    throw new Error(
      "No Kakao accounts configured. " +
      "Please configure at least one account in channels[\"kakao-talkchannel\"].accounts"
    );
  }

  // Prefer "default" if it exists
  if (ids.includes("default")) {
    return "default";
  }

  // Otherwise return first account
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
