/**
 * Kakao Callback Handler
 *
 * Handles sending responses via callback URL for slow-processing requests.
 * Kakao callbacks are single-use and expire after 1 minute (60000ms).
 *
 * Reference: docs/implementation-plan.md Section 2.3
 */

import type { KakaoSkillResponse } from "../types.js";

/**
 * Pending callback metadata
 *
 * Tracks callback URL and expiration time for deferred responses.
 */
export interface PendingCallback {
  /** Callback URL provided by Kakao */
  callbackUrl: string;
  /** Timestamp when callback expires (ms since epoch) */
  expiresAt: number;
  /** Message ID for tracking */
  messageId: string;
}

/**
 * Send response via callback URL
 *
 * POSTs the response to the callback URL provided by Kakao.
 * Used when processing takes longer than 5 seconds.
 *
 * @param callbackUrl - URL to POST response to
 * @param response - KakaoSkillResponse to send
 * @returns Result with success flag and optional error message
 */
export async function sendCallback(
  callbackUrl: string,
  response: KakaoSkillResponse
): Promise<{ success: boolean; error?: string }> {
  try {
    const fetchResponse = await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(response),
    });

    if (!fetchResponse.ok) {
      return {
        success: false,
        error: `HTTP ${fetchResponse.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Check if callback has expired
 *
 * Kakao callbacks are valid for 1 minute (60000ms).
 *
 * @param callback - Callback to check
 * @returns true if callback has expired, false otherwise
 */
export function isCallbackExpired(callback: PendingCallback): boolean {
  return Date.now() >= callback.expiresAt;
}

/**
 * Create callback tracker
 *
 * Manages pending callbacks with add, get, remove, and cleanup operations.
 *
 * @returns Callback tracker with add, get, remove, and cleanup methods
 */
export function createCallbackTracker(): {
  add: (callback: PendingCallback) => void;
  get: (messageId: string) => PendingCallback | undefined;
  remove: (messageId: string) => void;
  cleanup: () => void;
} {
  const callbacks = new Map<string, PendingCallback>();

  return {
    /**
     * Add callback to tracker
     *
     * @param callback - Callback to add
     */
    add(callback: PendingCallback): void {
      callbacks.set(callback.messageId, callback);
    },

    /**
     * Get callback by message ID
     *
     * @param messageId - Message ID to look up
     * @returns Callback if found, undefined otherwise
     */
    get(messageId: string): PendingCallback | undefined {
      return callbacks.get(messageId);
    },

    /**
     * Remove callback by message ID
     *
     * @param messageId - Message ID to remove
     */
    remove(messageId: string): void {
      callbacks.delete(messageId);
    },

    /**
     * Remove all expired callbacks
     */
    cleanup(): void {
      const now = Date.now();
      for (const [messageId, callback] of callbacks.entries()) {
        if (callback.expiresAt <= now) {
          callbacks.delete(messageId);
        }
      }
    },
  };
}
