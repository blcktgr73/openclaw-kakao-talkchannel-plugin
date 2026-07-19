/**
 * Pairing state registry.
 *
 * Owns the answer to "what is the current pairing code?" so an operator can ask
 * for it over the `openclaw` CLI instead of restarting the gateway and grepping
 * journald inside a five-minute window.
 *
 * Three properties this module exists to guarantee:
 *
 * 1. Reads are **non-destructive**. The previous `getPendingPairingInfo` deleted
 *    the entry on read, so the code could only ever be retrieved once.
 * 2. State is **cleared** when pairing completes, expires, or the account stops.
 *    The old map was only drained by that destructive read, so a stale code
 *    could linger in memory indefinitely.
 * 3. `pairing_complete` is **deduplicated**. The relay delivers it roughly four
 *    times in two seconds, and each one used to rewrite `openclaw.json`.
 */

export type PairingState = "unpaired" | "pending" | "paired" | "expired";

export interface PairingSnapshot {
  accountId: string;
  talkchannelId: string;
  state: PairingState;
  /** Present only while `state === "pending"`. */
  pairingCode: string | null;
  /** Epoch ms. Present only while `state === "pending"`. */
  expiresAt: number | null;
  /** Live countdown in seconds; negative values are clamped to 0. */
  expiresInSeconds: number | null;
  issuedAt: number | null;
  pairedUserId: string | null;
  pairedAt: number | null;
  /** False when the account is configured with a static token (nothing to re-issue). */
  canReissue: boolean;
  reissueBlockedReason: string | null;
}

export interface AccountController {
  /**
   * Drop the current session and obtain a fresh pairing code without a gateway
   * restart. Resolves once the relay has issued a code.
   */
  requestNewPairing: (timeoutMs: number) => Promise<PairingSnapshot>;
  /** Why re-issue is unavailable, or null when it is available. */
  reissueBlockedReason: () => string | null;
}

interface AccountEntry {
  accountId: string;
  talkchannelId: string;
  state: PairingState;
  pairingCode: string | null;
  expiresAt: number | null;
  issuedAt: number | null;
  pairedUserId: string | null;
  pairedAt: number | null;
  controller: AccountController | null;
  /** Resolvers waiting for the next `onPairingRequired`. */
  waiters: Array<(snapshot: PairingSnapshot) => void>;
}

const accounts = new Map<string, AccountEntry>();

/**
 * Change listeners. The gateway process uses these to publish state to disk so
 * the CLI — which cannot call into the gateway — can read it.
 */
type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();

export function onPairingChange(listener: ChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function notifyChange(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch {
      // A failing publisher must never break the pairing flow.
    }
  }
}

/**
 * Window within which repeated `pairing_complete` events for the same user are
 * treated as duplicates. The relay emits ~4 in 2s.
 */
const PAIRING_COMPLETE_DEDUPE_MS = 10_000;

function entryFor(accountId: string, talkchannelId?: string): AccountEntry {
  let entry = accounts.get(accountId);
  if (!entry) {
    entry = {
      accountId,
      talkchannelId: talkchannelId ?? accountId,
      state: "unpaired",
      pairingCode: null,
      expiresAt: null,
      issuedAt: null,
      pairedUserId: null,
      pairedAt: null,
      controller: null,
      waiters: [],
    };
    accounts.set(accountId, entry);
  }
  if (talkchannelId) entry.talkchannelId = talkchannelId;
  return entry;
}

function toSnapshot(entry: AccountEntry, now = Date.now()): PairingSnapshot {
  // A pending code that has run out reads as expired even if the relay has not
  // told us yet — the operator should not be handed a dead code.
  const expired =
    entry.state === "pending" && entry.expiresAt !== null && now >= entry.expiresAt;

  const state: PairingState = expired ? "expired" : entry.state;
  const pending = state === "pending";
  // `??` would be wrong here: a controller returning null means "re-issue is
  // available", which is exactly the nullish value `??` would replace.
  const blockedReason = entry.controller
    ? entry.controller.reissueBlockedReason()
    : "account is not running";

  return {
    accountId: entry.accountId,
    talkchannelId: entry.talkchannelId,
    state,
    pairingCode: pending ? entry.pairingCode : null,
    expiresAt: pending ? entry.expiresAt : null,
    expiresInSeconds:
      pending && entry.expiresAt !== null
        ? Math.max(0, Math.round((entry.expiresAt - now) / 1000))
        : null,
    issuedAt: entry.issuedAt,
    pairedUserId: entry.pairedUserId,
    pairedAt: entry.pairedAt,
    canReissue: blockedReason === null,
    reissueBlockedReason: blockedReason,
  };
}

// -- lifecycle wiring (called from the gateway adapter) ---------------------

export function registerAccount(
  accountId: string,
  talkchannelId: string,
  controller: AccountController
): void {
  const entry = entryFor(accountId, talkchannelId);
  entry.controller = controller;
  notifyChange();
}

export function unregisterAccount(accountId: string): void {
  const entry = accounts.get(accountId);
  if (!entry) return;
  // Waiters must not hang forever once the account is gone.
  const snapshot = toSnapshot(entry);
  for (const resolve of entry.waiters.splice(0)) resolve(snapshot);
  accounts.delete(accountId);
  notifyChange();
}

export function recordPairingRequired(
  accountId: string,
  talkchannelId: string,
  pairingCode: string,
  expiresInSeconds: number
): PairingSnapshot {
  const entry = entryFor(accountId, talkchannelId);
  const now = Date.now();

  entry.state = "pending";
  entry.pairingCode = pairingCode;
  entry.issuedAt = now;
  entry.expiresAt = now + expiresInSeconds * 1000;
  entry.pairedUserId = null;
  entry.pairedAt = null;

  const snapshot = toSnapshot(entry, now);
  notifyChange();
  for (const resolve of entry.waiters.splice(0)) resolve(snapshot);
  return snapshot;
}

/**
 * Record a completed pairing.
 *
 * @returns true when this is the first completion for this user, false for the
 *   duplicate events the relay sends immediately afterwards. Callers should skip
 *   side effects (config writes, logging) on false.
 */
export function recordPairingComplete(
  accountId: string,
  talkchannelId: string,
  kakaoUserId: string
): boolean {
  const entry = entryFor(accountId, talkchannelId);
  const now = Date.now();

  const isDuplicate =
    entry.state === "paired" &&
    entry.pairedUserId === kakaoUserId &&
    entry.pairedAt !== null &&
    now - entry.pairedAt < PAIRING_COMPLETE_DEDUPE_MS;

  if (isDuplicate) return false;

  entry.state = "paired";
  entry.pairingCode = null;
  entry.expiresAt = null;
  entry.pairedUserId = kakaoUserId;
  entry.pairedAt = now;
  notifyChange();
  return true;
}

export function recordPairingExpired(accountId: string, talkchannelId: string): void {
  const entry = entryFor(accountId, talkchannelId);
  entry.state = "expired";
  entry.pairingCode = null;
  entry.expiresAt = null;
  notifyChange();
}

/** Mark an account as already paired because a saved session token was reused. */
export function recordSessionReused(accountId: string, talkchannelId: string): void {
  const entry = entryFor(accountId, talkchannelId);
  if (entry.state === "pending") return;
  entry.state = "paired";
  entry.pairingCode = null;
  entry.expiresAt = null;
  notifyChange();
}

/** Forget any paired state — the relay rejected the token. */
export function recordSessionInvalidated(accountId: string, talkchannelId: string): void {
  const entry = entryFor(accountId, talkchannelId);
  entry.state = "unpaired";
  entry.pairingCode = null;
  entry.expiresAt = null;
  entry.pairedUserId = null;
  entry.pairedAt = null;
  notifyChange();
}

// -- reads (called from the gateway RPC / CLI) ------------------------------

export function getPairingSnapshot(accountId?: string): PairingSnapshot | null {
  if (accountId) {
    const entry = accounts.get(accountId);
    return entry ? toSnapshot(entry) : null;
  }
  const first = accounts.values().next();
  return first.done ? null : toSnapshot(first.value);
}

export function listPairingSnapshots(): PairingSnapshot[] {
  return [...accounts.values()].map((entry) => toSnapshot(entry));
}

/** Resolve once the next pairing code is issued for this account. */
export function awaitPairingCode(accountId: string, timeoutMs: number): Promise<PairingSnapshot> {
  const entry = entryFor(accountId);

  return new Promise<PairingSnapshot>((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = entry.waiters.indexOf(onIssued);
      if (index >= 0) entry.waiters.splice(index, 1);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for a pairing code`));
    }, timeoutMs);

    function onIssued(snapshot: PairingSnapshot): void {
      clearTimeout(timer);
      resolve(snapshot);
    }

    entry.waiters.push(onIssued);
  });
}

export async function requestNewPairing(
  accountId: string | undefined,
  timeoutMs: number
): Promise<PairingSnapshot> {
  const entry = accountId
    ? accounts.get(accountId)
    : (accounts.values().next().value as AccountEntry | undefined);

  if (!entry) {
    throw new Error(
      accountId
        ? `Unknown Kakao account "${accountId}". Is the gateway running?`
        : "No Kakao account is running. Start the gateway first."
    );
  }
  if (!entry.controller) {
    throw new Error(`Kakao account "${entry.accountId}" is not running.`);
  }

  const blocked = entry.controller.reissueBlockedReason();
  if (blocked) throw new Error(blocked);

  return entry.controller.requestNewPairing(timeoutMs);
}

/** Test seam. */
export function __resetPairingRegistry(): void {
  accounts.clear();
  changeListeners.clear();
}
