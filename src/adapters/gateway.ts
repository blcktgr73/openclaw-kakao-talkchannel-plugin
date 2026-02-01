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

async function registerWebhookRoute(
  talkchannel: ResolvedKakaoTalkChannel,
  _cfg: unknown,
  log?: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
  if (log) {
    log.info(
      `[kakao:${talkchannel.talkchannelId}] Direct mode ready at ${talkchannel.config.publicWebhookUrl ?? talkchannel.config.webhookPath}`
    );
  }

  return Promise.resolve();
}

export const gatewayAdapter = {
  startTalkChannel: async (ctx: GatewayContext): Promise<void> => {
    const { talkchannel, cfg, abortSignal, onMessage, log } = ctx;

    if (talkchannel.config.mode === "relay") {
      if (log) {
        log.info(
          `[kakao:${talkchannel.talkchannelId}] Starting SSE stream to ${talkchannel.config.relayUrl}`
        );
      }
      return startRelayStream(talkchannel, onMessage, abortSignal);
    } else {
      return registerWebhookRoute(talkchannel, cfg, log);
    }
  },

  stopTalkChannel: async (_ctx: StopTalkChannelContext): Promise<void> => {
    return Promise.resolve();
  },
};
