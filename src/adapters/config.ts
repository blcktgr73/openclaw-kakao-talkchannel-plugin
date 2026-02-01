/**
 * Kakao Channel Config Adapter
 * 
 * Implements ChannelConfigAdapter interface for Kakao plugin configuration.
 * Provides methods to:
 * - List configured account IDs
 * - Resolve individual accounts with validation
 * - Get default account ID
 * - Check account configuration and enabled status
 * 
 * Reference: docs/implementation-plan.md Section 4.1 (lines 371-381)
 */

import type { ResolvedKakaoAccount } from "../types.js";
import { resolveKakaoAccount, listKakaoAccountIds, getDefaultAccountId } from "../config/accounts.js";

/**
 * ChannelConfigAdapter interface
 * 
 * Generic adapter for channel configuration management.
 * Provides abstraction for account resolution and status checking.
 */
export interface ChannelConfigAdapter<T> {
  /**
   * List all configured account IDs
   * @param cfg - Plugin configuration object
   * @returns Array of account IDs (empty if none configured)
   */
  listAccountIds: (cfg: unknown) => string[];

  /**
   * Resolve a specific account from configuration
   * @param cfg - Plugin configuration object
   * @param accountId - Account identifier
   * @returns Resolved account with validated configuration
   * @throws Error if account not found or config invalid
   */
  resolveAccount: (cfg: unknown, accountId: string) => T;

  /**
   * Get the default account ID
   * @param cfg - Plugin configuration object
   * @returns Default account ID ("default" if exists, otherwise first account)
   * @throws Error if no accounts configured
   */
  defaultAccountId: (cfg: unknown) => string;

  /**
   * Check if account is properly configured
   * @param account - Resolved account
   * @returns True if account has required channelId
   */
  isConfigured: (account: T) => boolean;

  /**
   * Check if account is enabled
   * @param account - Resolved account
   * @returns True if account is enabled
   */
  isEnabled: (account: T) => boolean;
}

/**
 * Kakao channel configuration adapter
 * 
 * Implements ChannelConfigAdapter for ResolvedKakaoAccount.
 * Uses account resolution from src/config/accounts.ts.
 */
export const configAdapter: ChannelConfigAdapter<ResolvedKakaoAccount> = {
  listAccountIds: (cfg) => {
    try {
      return listKakaoAccountIds(cfg);
    } catch {
      return [];
    }
  },

  resolveAccount: (cfg, accountId) => {
    return resolveKakaoAccount(cfg, accountId);
  },

  defaultAccountId: (cfg) => {
    return getDefaultAccountId(cfg);
  },

  isConfigured: (account) => {
    return Boolean(account.config.channelId);
  },

  isEnabled: (account) => {
    return account.config.enabled;
  },
};
