/**
 * Kakao Channel Gateway Adapter (Simplified)
 *
 * Relay mode only - always starts SSE stream.
 */

import type { ResolvedKakaoTalkChannel, InboundMessage } from "../types.js";
import { startRelayStream } from "../relay/stream.js";

export interface GatewayContext {
  talkchannel: ResolvedKakaoTalkChannel;
  cfg: unknown;
  abortSignal: AbortSignal;
  onMessage: (msg: InboundMessage) => Promise<void>;
  log?: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface StopTalkChannelContext {
  talkchannelId: string;
}

export const gatewayAdapter = {
  startTalkChannel: async (ctx: GatewayContext): Promise<void> => {
    const { talkchannel, abortSignal, onMessage, log } = ctx;

    if (log) {
      log.info(
        `[kakao:${talkchannel.talkchannelId}] Starting SSE stream to ${talkchannel.config.relayUrl}`
      );
    }

    return startRelayStream(talkchannel, onMessage, abortSignal);
  },

  stopTalkChannel: async (_ctx: StopTalkChannelContext): Promise<void> => {
    return Promise.resolve();
  },
};
