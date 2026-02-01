import type { ResolvedKakaoAccount, InboundMessage } from "../types.js";
import { connectSSE } from "./sse.js";
import { getKakaoRuntime } from "../runtime.js";
import { createSession, DEFAULT_RELAY_URL } from "./session.js";

export interface StreamOptions {
  maxRetries?: number;
}

export interface StreamCallbacks {
  onPairingRequired?: (pairingCode: string, expiresIn: number) => void;
  onPairingComplete?: (kakaoUserId: string) => void;
  onPairingExpired?: (reason: string) => void;
}

const DEFAULT_STREAM_OPTIONS: Required<StreamOptions> = {
  maxRetries: 10,
};

/**
 * Resolve the authentication token for relay connection
 *
 * Priority:
 * 1. sessionToken from config
 * 2. relayToken from config
 * 3. OPENCLAW_TALKCHANNEL_RELAY_TOKEN environment variable
 * 4. Create new session (returns pairing code via callback)
 */
async function resolveToken(
  account: ResolvedKakaoAccount,
  callbacks: StreamCallbacks
): Promise<{ token: string; relayUrl: string; isNewSession: boolean }> {
  const relayUrl = account.config.relayUrl ?? DEFAULT_RELAY_URL;

  // 1. Check sessionToken
  if (account.config.sessionToken) {
    return { token: account.config.sessionToken, relayUrl, isNewSession: false };
  }

  // 2. Check relayToken
  if (account.config.relayToken) {
    return { token: account.config.relayToken, relayUrl, isNewSession: false };
  }

  // 3. Check environment variable
  const envToken = process.env.OPENCLAW_TALKCHANNEL_RELAY_TOKEN;
  if (envToken) {
    return { token: envToken, relayUrl, isNewSession: false };
  }

  // 4. Create new session
  const result = await createSession(relayUrl);
  if (!result.ok) {
    throw new Error(`Failed to create session: ${result.error.message}`);
  }

  // Notify about pairing requirement
  callbacks.onPairingRequired?.(result.data.pairingCode, result.data.expiresIn);

  return { token: result.data.sessionToken, relayUrl, isNewSession: true };
}

export async function startRelayStream(
  account: ResolvedKakaoAccount,
  onMessage: (msg: InboundMessage) => Promise<void>,
  abortSignal: AbortSignal,
  opts: StreamOptions = {},
  callbacks: StreamCallbacks = {}
): Promise<void> {
  const runtime = getKakaoRuntime();
  const options = { ...DEFAULT_STREAM_OPTIONS, ...opts };

  // Resolve token (may create new session)
  const { token, relayUrl, isNewSession } = await resolveToken(account, callbacks);
  const { reconnectDelayMs, maxReconnectDelayMs } = account.config;

  let reconnectCount = 0;

  await connectSSE(
    {
      relayUrl,
      sessionToken: token,
      reconnectDelayMs,
      maxReconnectDelayMs,
    },
    {
      onMessage: async (msg) => {
        reconnectCount = 0;
        await onMessage(msg);
      },
      onConnected: () => {
        runtime.logger.info(`[kakao:${account.accountId}] SSE connected to ${relayUrl}`);
        reconnectCount = 0;
      },
      onError: (error) => {
        const sanitizedError = error.message.replace(/token=[^&\s]+/gi, "token=***");
        runtime.logger.warn(`[kakao:${account.accountId}] SSE error: ${sanitizedError}`);
      },
      onReconnect: (attempt) => {
        reconnectCount = attempt;
        runtime.logger.info(`[kakao:${account.accountId}] SSE reconnecting (attempt ${attempt})`);

        if (reconnectCount >= options.maxRetries) {
          runtime.logger.error(`[kakao:${account.accountId}] Max reconnect attempts exceeded`);
        }
      },
      onPairingComplete: (data) => {
        runtime.logger.info(`[kakao:${account.accountId}] Pairing complete: ${data.kakaoUserId}`);
        callbacks.onPairingComplete?.(data.kakaoUserId);
      },
      onPairingExpired: (reason) => {
        runtime.logger.warn(`[kakao:${account.accountId}] Pairing expired: ${reason}`);
        callbacks.onPairingExpired?.(reason);
      },
    },
    abortSignal
  );
}

export { connectSSE, parseSSEChunk, calculateReconnectDelay } from "./sse.js";
