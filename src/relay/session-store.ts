/**
 * Persistent storage for paired relay sessions.
 *
 * The pairing session token used to live only in an in-memory Map, so every
 * gateway restart threw it away and forced the user to pair again. This store
 * is SQLite-backed through the OpenClaw plugin state API, so a completed
 * pairing survives restarts until the relay actually invalidates it.
 *
 * Follows the pattern the bundled Telegram channel uses for its update-offset
 * store: a plugin-owned namespace, per-account keying done by the plugin, a
 * version field validated on read, and a stored relay URL so state belonging
 * to a different relay is discarded instead of replayed against it.
 *
 * Storage is best-effort by design. A failing state store must never stop the
 * channel from connecting or pairing — it only costs the user a re-pair.
 */
import { getKakaoRuntime } from "../runtime.js";

const NAMESPACE = "kakao-talkchannel.sessions";
const MAX_ENTRIES = 100;
const STORE_VERSION = 1;

export interface StoredRelaySession {
  version: number;
  sessionToken: string;
  relayUrl: string;
}

interface StoreLogger {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
}

function openStore() {
  return getKakaoRuntime().state.openKeyedStore<StoredRelaySession>({
    namespace: NAMESPACE,
    maxEntries: MAX_ENTRIES,
  });
}

/** The SDK hands out a flat namespace; account scoping is the plugin's job. */
export function normalizeAccountKey(accountId: string): string {
  const trimmed = accountId.trim();
  return trimmed.length > 0 ? trimmed : "default";
}

/** Compared normalized so a trailing slash alone is not treated as a new relay. */
function normalizeRelayUrl(relayUrl: string): string {
  return relayUrl.endsWith("/") ? relayUrl : `${relayUrl}/`;
}

function isStoredRelaySession(value: unknown): value is StoredRelaySession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<StoredRelaySession>;
  return (
    candidate.version === STORE_VERSION &&
    typeof candidate.sessionToken === "string" &&
    candidate.sessionToken.length > 0 &&
    typeof candidate.relayUrl === "string" &&
    candidate.relayUrl.length > 0
  );
}

/**
 * Return a previously paired session token for this account, or null.
 *
 * Returns null when nothing is stored, when the stored shape does not match
 * the current version, or when the pairing belongs to a different relay —
 * replaying a token against another relay would only produce a 401.
 */
export async function readStoredSession(
  accountId: string,
  relayUrl: string,
  log?: StoreLogger
): Promise<string | null> {
  try {
    const stored = await openStore().lookup(normalizeAccountKey(accountId));
    if (stored === undefined) {
      return null;
    }
    if (!isStoredRelaySession(stored)) {
      log?.warn?.("[kakao-talkchannel] Stored session has an unexpected shape; ignoring it");
      return null;
    }
    if (normalizeRelayUrl(stored.relayUrl) !== normalizeRelayUrl(relayUrl)) {
      log?.info?.("[kakao-talkchannel] Stored session belongs to a different relay; ignoring it");
      return null;
    }
    return stored.sessionToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.warn?.(`[kakao-talkchannel] Could not read stored session: ${message}`);
    return null;
  }
}

/**
 * Persist a paired session token.
 *
 * Only call this once pairing has actually completed. An unpaired session is
 * deleted by the relay when its pairing code expires, so persisting one would
 * guarantee a 401 on the next start.
 */
export async function writeStoredSession(
  accountId: string,
  sessionToken: string,
  relayUrl: string,
  log?: StoreLogger
): Promise<void> {
  try {
    await openStore().register(normalizeAccountKey(accountId), {
      version: STORE_VERSION,
      sessionToken,
      relayUrl,
    });
    log?.info?.("[kakao-talkchannel] Pairing persisted; it will survive a gateway restart");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.warn?.(`[kakao-talkchannel] Could not persist pairing: ${message}`);
  }
}

/** Drop a stored session once the relay has rejected it. */
export async function clearStoredSession(accountId: string, log?: StoreLogger): Promise<void> {
  try {
    await openStore().delete(normalizeAccountKey(accountId));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log?.warn?.(`[kakao-talkchannel] Could not clear stored session: ${message}`);
  }
}
