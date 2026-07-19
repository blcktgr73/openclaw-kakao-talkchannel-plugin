/**
 * Persistence for a completed pairing.
 *
 * The pairing token used to live only in an in-memory Map, so every gateway
 * restart threw it away and the user had to pair again with a fresh code.
 *
 * The token is written back into the account's own config entry, which is
 * where `resolveToken` already looks first and where the setup wizard already
 * writes it. Nothing extra is needed to restore it: the gateway reloads
 * openclaw.json on start and hands the account config straight to the stream.
 *
 * `runtime.state.openKeyedStore` — the store the bundled Telegram channel uses
 * — is not an option here. It is gated to bundled or officially installed
 * plugins ("openKeyedStore is only available for trusted plugins in this
 * release"), and a locally linked plugin does not qualify. `runtime.config` has
 * no such gate.
 *
 * Persistence is best-effort throughout: failing to save costs the user a
 * re-pair, never a dead channel.
 */
import { getKakaoRuntime } from "../runtime.js";

const CHANNEL_ID = "kakao-talkchannel";

interface StoreLogger {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
}

type MutableRecord = Record<string, unknown>;

/** Walk to the account entry, creating the intermediate objects as needed. */
function accountEntry(draft: MutableRecord, talkchannelId: string): MutableRecord {
  const channels = (draft.channels ??= {}) as MutableRecord;
  const channel = (channels[CHANNEL_ID] ??= {}) as MutableRecord;
  const accounts = (channel.accounts ??= {}) as MutableRecord;
  return (accounts[talkchannelId] ??= {}) as MutableRecord;
}

async function mutateAccount(
  talkchannelId: string,
  apply: (account: MutableRecord) => void
): Promise<void> {
  await getKakaoRuntime().config.mutateConfigFile({
    // "none" on purpose. This write only records a token the running process
    // already holds, so a reload or restart would cost a reconnect and buy
    // nothing — and restarting from inside the pairing flow would loop.
    afterWrite: { mode: "none", reason: "kakao-talkchannel pairing token" },
    mutate: (draft) => {
      apply(accountEntry(draft as MutableRecord, talkchannelId));
    },
  });
}

/**
 * Save a paired session token so the pairing survives a restart.
 *
 * Only call this once pairing has completed. The relay deletes a session when
 * its pairing code expires, so persisting an unpaired token would guarantee a
 * 401 on the next start.
 */
export async function persistSessionToken(
  talkchannelId: string,
  sessionToken: string,
  log?: StoreLogger
): Promise<void> {
  try {
    await mutateAccount(talkchannelId, (account) => {
      account.sessionToken = sessionToken;
    });
    log?.info?.(
      `[kakao-talkchannel:${talkchannelId}] Pairing saved; it will survive a gateway restart`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.warn?.(
      `[kakao-talkchannel:${talkchannelId}] Could not save the pairing: ${message}. ` +
        `Pairing will be required again after a restart.`
    );
  }
}

/** Drop a saved token once the relay has rejected it. */
export async function forgetSessionToken(
  talkchannelId: string,
  log?: StoreLogger
): Promise<void> {
  try {
    await mutateAccount(talkchannelId, (account) => {
      delete account.sessionToken;
    });
    log?.info?.(`[kakao-talkchannel:${talkchannelId}] Saved pairing cleared`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.warn?.(
      `[kakao-talkchannel:${talkchannelId}] Could not clear the saved pairing: ${message}`
    );
  }
}
