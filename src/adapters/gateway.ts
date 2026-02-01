/**
 * Kakao Channel Gateway Adapter (Simplified)
 *
 * Relay mode only - always starts SSE stream.
 * Uses OpenClaw standard naming: account, startAccount, stopAccount
 */

import type { ResolvedKakaoTalkChannel, InboundMessage } from "../types.js";
import { startRelayStream, type StreamCallbacks } from "../relay/stream.js";

export interface GatewayContext {
  account: ResolvedKakaoTalkChannel;
  cfg: unknown;
  abortSignal: AbortSignal;
  onMessage: (msg: InboundMessage) => Promise<void>;
  onPairingRequired?: (pairingCode: string, expiresIn: number) => void;
  onPairingComplete?: (kakaoUserId: string) => void;
  log?: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface StopAccountContext {
  accountId: string;
}

export interface StartAccountResult {
  pairingCode?: string;
  expiresIn?: number;
}

// Store for pairing info to be retrieved later
let pendingPairingInfo: { pairingCode: string; expiresIn: number } | null = null;

export function getPendingPairingInfo(): { pairingCode: string; expiresIn: number } | null {
  const info = pendingPairingInfo;
  pendingPairingInfo = null; // Clear after reading
  return info;
}

export const gatewayAdapter = {
  startAccount: async (ctx: GatewayContext): Promise<void> => {
    const { account, abortSignal, onMessage, onPairingRequired, onPairingComplete, log } = ctx;

    if (log) {
      log.info(
        `[kakao-talkchannel:${account.talkchannelId}] Starting SSE stream to ${account.config.relayUrl}`
      );
    }

    const callbacks: StreamCallbacks = {
      onPairingRequired: (pairingCode, expiresIn) => {
        // Store pairing info for later retrieval
        pendingPairingInfo = { pairingCode, expiresIn };

        // Log the pairing code prominently
        if (log) {
          log.info(`[kakao-talkchannel:${account.talkchannelId}] ========================================`);
          log.info(`[kakao-talkchannel:${account.talkchannelId}] 🔗 페어링 코드: ${pairingCode}`);
          log.info(`[kakao-talkchannel:${account.talkchannelId}] 카카오톡에서 /pair ${pairingCode} 입력하세요`);
          log.info(`[kakao-talkchannel:${account.talkchannelId}] 유효시간: ${Math.floor(expiresIn / 60)}분`);
          log.info(`[kakao-talkchannel:${account.talkchannelId}] ========================================`);
        }

        // Call external callback if provided
        onPairingRequired?.(pairingCode, expiresIn);
      },
      onPairingComplete: (kakaoUserId) => {
        if (log) {
          log.info(`[kakao-talkchannel:${account.talkchannelId}] ✅ 페어링 완료: ${kakaoUserId}`);
        }
        onPairingComplete?.(kakaoUserId);
      },
      onPairingExpired: (reason) => {
        if (log) {
          log.info(`[kakao-talkchannel:${account.talkchannelId}] ⚠️ 페어링 만료: ${reason}`);
        }
      },
    };

    return startRelayStream(account, onMessage, abortSignal, {}, callbacks);
  },

  stopAccount: async (_ctx: StopAccountContext): Promise<void> => {
    return Promise.resolve();
  },

  getPendingPairingInfo,
};
