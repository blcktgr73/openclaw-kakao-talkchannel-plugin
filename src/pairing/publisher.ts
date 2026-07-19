/**
 * Gateway-side bridge between the pairing registry and the CLI.
 *
 * Runs inside the gateway process. Two jobs:
 *
 * 1. Publish every registry change to `pairing-state.json` so `openclaw kakao
 *    pairing status` can read it from a separate process.
 * 2. Poll `pairing-request.json` so `openclaw kakao pairing new` can ask this
 *    process to re-issue a code.
 *
 * Polling rather than file watching is deliberate: it is what the state hand-off
 * needs to be, it has no watcher-leak failure mode, and a missed tick only costs
 * a second.
 */

import { listPairingSnapshots, onPairingChange, requestNewPairing } from "./registry.js";
import {
  clearPairingRequest,
  clearPairingState,
  consumePairingRequest,
  writePairingState,
} from "./state-file.js";

export const REQUEST_POLL_INTERVAL_MS = 1000;

export interface PublisherLog {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
}

interface PublisherHandle {
  stop: () => void;
}

let active: (PublisherHandle & { refCount: number }) | null = null;

/**
 * Start publishing, or join an already-running publisher.
 *
 * Accounts start and stop independently, so this is reference counted; the
 * files are only torn down when the last account goes away.
 */
export function startPairingPublisher(log?: PublisherLog): () => void {
  if (active) {
    active.refCount += 1;
    const handle = active;
    return () => release(handle);
  }

  // A request written while this process was down refers to a gateway that no
  // longer exists. Honouring it later would re-issue a code nobody asked for.
  clearPairingRequest();

  const publish = (): void => {
    try {
      writePairingState(listPairingSnapshots());
    } catch (error) {
      log?.warn?.(
        `[kakao-talkchannel] Could not publish pairing state: ${errorMessage(error)}`
      );
    }
  };

  publish();
  const unsubscribe = onPairingChange(publish);

  const timer = setInterval(() => {
    void pollRequest(log, publish);
  }, REQUEST_POLL_INTERVAL_MS);
  // Never hold the process open for this.
  timer.unref?.();

  const handle: PublisherHandle & { refCount: number } = {
    refCount: 1,
    stop: () => {
      unsubscribe();
      clearInterval(timer);
      clearPairingState();
      clearPairingRequest();
    },
  };
  active = handle;

  return () => release(handle);
}

function release(handle: PublisherHandle & { refCount: number }): void {
  handle.refCount -= 1;
  if (handle.refCount > 0) return;
  handle.stop();
  if (active === handle) active = null;
}

async function pollRequest(log: PublisherLog | undefined, publish: () => void): Promise<void> {
  let request;
  try {
    request = consumePairingRequest();
  } catch (error) {
    log?.warn?.(`[kakao-talkchannel] Could not read pairing request: ${errorMessage(error)}`);
    return;
  }
  if (!request) return;

  log?.info?.(
    `[kakao-talkchannel] Re-issue requested via CLI (request ${request.id})`
  );

  try {
    await requestNewPairing(request.accountId, request.timeoutMs);
    // requestNewPairing resolves once the code exists, and recordPairingRequired
    // has already fired publish() by then. Publishing again is harmless and
    // guards against a listener that was not yet attached.
    publish();
  } catch (error) {
    log?.warn?.(
      `[kakao-talkchannel] CLI re-issue failed: ${errorMessage(error)}`
    );
    // The CLI detects this by timing out; the failure reason is in the log.
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Test seam. */
export function __resetPairingPublisher(): void {
  if (active) {
    active.stop();
    active = null;
  }
}
