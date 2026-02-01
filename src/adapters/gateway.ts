import type { ResolvedKakaoAccount, InboundMessage } from "../types.js";
import { startRelayStream } from "../relay/stream.js";

export interface GatewayContext {
  account: ResolvedKakaoAccount;
  cfg: unknown;
  abortSignal: AbortSignal;
  onMessage: (msg: InboundMessage) => Promise<void>;
  log?: {
    info: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface StopAccountContext {
  accountId: string;
}

async function registerWebhookRoute(
  account: ResolvedKakaoAccount,
  _cfg: unknown,
  log?: { info: (msg: string) => void; error: (msg: string) => void }
): Promise<void> {
  if (log) {
    log.info(
      `[kakao:${account.accountId}] Direct mode ready at ${account.config.publicWebhookUrl ?? account.config.webhookPath}`
    );
  }

  return Promise.resolve();
}

export const gatewayAdapter = {
  startAccount: async (ctx: GatewayContext): Promise<void> => {
    const { account, cfg, abortSignal, onMessage, log } = ctx;

    if (account.config.mode === "relay") {
      if (log) {
        log.info(
          `[kakao:${account.accountId}] Starting SSE stream to ${account.config.relayUrl}`
        );
      }
      return startRelayStream(account, onMessage, abortSignal);
    } else {
      return registerWebhookRoute(account, cfg, log);
    }
  },

  stopAccount: async (_ctx: StopAccountContext): Promise<void> => {
    return Promise.resolve();
  },
};
