/**
 * Kakao Channel Config Adapter
 *
 * Implements ChannelConfigAdapter interface for Kakao plugin configuration.
 * Provides methods to:
 * - List configured talkchannel IDs
 * - Resolve individual talkchannels with validation
 * - Get default talkchannel ID
 * - Check talkchannel configuration and enabled status
 *
 * Reference: docs/implementation-plan.md Section 4.1 (lines 371-381)
 */

import type { ResolvedKakaoTalkChannel } from "../types.js";
import { resolveKakaoTalkChannel, listKakaoTalkChannelIds, getDefaultTalkChannelId } from "../config/talkchannels.js";

/**
 * ChannelConfigAdapter interface
 *
 * Generic adapter for channel configuration management.
 * Provides abstraction for talkchannel resolution and status checking.
 */
export interface ChannelConfigAdapter<T> {
  /**
   * List all configured talkchannel IDs
   * @param cfg - Plugin configuration object
   * @returns Array of talkchannel IDs (empty if none configured)
   */
  listTalkChannelIds: (cfg: unknown) => string[];

  /**
   * Resolve a specific talkchannel from configuration
   * @param cfg - Plugin configuration object
   * @param talkchannelId - TalkChannel identifier
   * @returns Resolved talkchannel with validated configuration
   * @throws Error if talkchannel not found or config invalid
   */
  resolveTalkChannel: (cfg: unknown, talkchannelId: string) => T;

  /**
   * Get the default talkchannel ID
   * @param cfg - Plugin configuration object
   * @returns Default talkchannel ID ("default" if exists, otherwise first talkchannel)
   * @throws Error if no talkchannels configured
   */
  defaultTalkChannelId: (cfg: unknown) => string;

  /**
   * Check if talkchannel is properly configured
   * @param talkchannel - Resolved talkchannel
   * @returns True if talkchannel has required channelId
   */
  isConfigured: (talkchannel: T) => boolean;

  /**
   * Check if talkchannel is enabled
   * @param talkchannel - Resolved talkchannel
   * @returns True if talkchannel is enabled
   */
  isEnabled: (talkchannel: T) => boolean;
}

/**
 * Kakao channel configuration adapter
 *
 * Implements ChannelConfigAdapter for ResolvedKakaoTalkChannel.
 * Uses talkchannel resolution from src/config/talkchannels.ts.
 */
export const configAdapter: ChannelConfigAdapter<ResolvedKakaoTalkChannel> = {
  listTalkChannelIds: (cfg) => {
    try {
      return listKakaoTalkChannelIds(cfg);
    } catch {
      return [];
    }
  },

  resolveTalkChannel: (cfg, talkchannelId) => {
    return resolveKakaoTalkChannel(cfg, talkchannelId);
  },

  defaultTalkChannelId: (cfg) => {
    return getDefaultTalkChannelId(cfg);
  },

  isConfigured: (talkchannel) => {
    // For relay mode: configured if token available or can auto-create session
    if (talkchannel.mode === "relay") {
      return Boolean(
        talkchannel.config.sessionToken ||
        talkchannel.config.relayToken ||
        process.env.OPENCLAW_TALKCHANNEL_RELAY_TOKEN ||
        true // Can always auto-create session
      );
    }
    // For direct mode: channelId is required
    return Boolean(talkchannel.config.channelId);
  },

  isEnabled: (talkchannel) => {
    return talkchannel.config.enabled;
  },
};
