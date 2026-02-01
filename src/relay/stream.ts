import type { ResolvedKakaoAccount, InboundMessage } from "../types.js";
import { connectSSE } from "./sse.js";
import { getKakaoRuntime } from "../runtime.js";

export interface StreamOptions {
  maxRetries?: number;
}

const DEFAULT_STREAM_OPTIONS: Required<StreamOptions> = {
  maxRetries: 10,
};

export async function startRelayStream(
  account: ResolvedKakaoAccount,
  onMessage: (msg: InboundMessage) => Promise<void>,
  abortSignal: AbortSignal,
  opts: StreamOptions = {}
): Promise<void> {
  const runtime = getKakaoRuntime();
  const options = { ...DEFAULT_STREAM_OPTIONS, ...opts };

  if (!account.config.relayUrl || !account.config.relayToken) {
    throw new Error(
      `Relay mode requires relayUrl and relayToken for account "${account.accountId}"`
    );
  }

  const { relayUrl, relayToken, reconnectDelayMs, maxReconnectDelayMs } = account.config;
  let reconnectCount = 0;

  await connectSSE(
    {
      relayUrl,
      relayToken,
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
    },
    abortSignal
  );
}

export { connectSSE, parseSSEChunk, calculateReconnectDelay } from "./sse.js";
