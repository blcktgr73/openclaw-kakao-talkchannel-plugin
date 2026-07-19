/**
 * Gateway wiring for pairing persistence.
 *
 * The pairing token used to live only in an in-memory Map, so restarting the
 * gateway threw it away and the user had to pair again with a fresh code.
 * These tests pin the wiring that makes a completed pairing survive a restart.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedKakaoTalkChannel } from "../../../src/types";
import type { StreamCallbacks } from "../../../src/relay/stream";

const startRelayStream = vi.fn().mockResolvedValue(undefined);
const readStoredSession = vi.fn();
const writeStoredSession = vi.fn();
const clearStoredSession = vi.fn();

vi.mock("../../../src/runtime.js", () => ({
  getKakaoRuntime: () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }),
}));

vi.mock("../../../src/relay/stream.js", () => ({
  startRelayStream: (...args: unknown[]) => startRelayStream(...args),
}));

vi.mock("../../../src/relay/session-store.js", () => ({
  readStoredSession: (...args: unknown[]) => readStoredSession(...args),
  writeStoredSession: (...args: unknown[]) => writeStoredSession(...args),
  clearStoredSession: (...args: unknown[]) => clearStoredSession(...args),
}));

const { gatewayAdapter } = await import("../../../src/adapters/gateway");

const RELAY = "https://relay.example.com/";

function makeAccount(overrides: Record<string, unknown> = {}): ResolvedKakaoTalkChannel {
  return {
    talkchannelId: "default",
    config: { enabled: true, relayUrl: RELAY, dmPolicy: "pairing", ...overrides },
  } as unknown as ResolvedKakaoTalkChannel;
}

function startCtx(account: ResolvedKakaoTalkChannel) {
  return {
    account,
    accountId: "acct-1",
    cfg: {},
    abortSignal: new AbortController().signal,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as never;
}

/** Callbacks are the 5th argument handed to startRelayStream. */
function capturedCallbacks(): StreamCallbacks {
  return startRelayStream.mock.calls[0][4] as StreamCallbacks;
}

function accountPassedToStream(): ResolvedKakaoTalkChannel {
  return startRelayStream.mock.calls[0][0] as ResolvedKakaoTalkChannel;
}

describe("gateway pairing persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startRelayStream.mockResolvedValue(undefined);
    readStoredSession.mockResolvedValue(null);
    writeStoredSession.mockResolvedValue(undefined);
    clearStoredSession.mockResolvedValue(undefined);
  });

  it("restores a stored pairing so no new code is issued", async () => {
    readStoredSession.mockResolvedValue("stored-token");

    await gatewayAdapter.startAccount(startCtx(makeAccount()));

    expect(readStoredSession).toHaveBeenCalledWith("acct-1", RELAY, expect.anything());
    expect(accountPassedToStream().config.sessionToken).toBe("stored-token");
  });

  it("starts a fresh pairing when nothing is stored", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));

    expect(accountPassedToStream().config.sessionToken).toBeUndefined();
  });

  it("lets an explicit configured sessionToken win over the stored one", async () => {
    readStoredSession.mockResolvedValue("stored-token");

    await gatewayAdapter.startAccount(startCtx(makeAccount({ sessionToken: "configured" })));

    // An operator-set token is a deliberate choice; never override it.
    expect(readStoredSession).not.toHaveBeenCalled();
    expect(accountPassedToStream().config.sessionToken).toBe("configured");
  });

  it("persists the pairing only once the relay confirms it completed", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));
    const callbacks = capturedCallbacks();

    callbacks.onTokenResolved?.("fresh-token", RELAY);
    // Before pairing completes the relay deletes the session when its code
    // expires, so nothing may be written yet.
    expect(writeStoredSession).not.toHaveBeenCalled();

    callbacks.onPairingComplete?.("kakao-user-1");
    expect(writeStoredSession).toHaveBeenCalledWith(
      "acct-1",
      "fresh-token",
      RELAY,
      expect.anything()
    );
  });

  it("does not persist anything if pairing completes without a resolved token", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));

    capturedCallbacks().onPairingComplete?.("kakao-user-1");

    expect(writeStoredSession).not.toHaveBeenCalled();
  });

  it("drops the stored pairing once the relay rejects the token", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));
    const callbacks = capturedCallbacks();

    callbacks.onTokenResolved?.("fresh-token", RELAY);
    callbacks.onSessionInvalidated?.(401);

    // Keeping it would only reproduce the rejection on the next start.
    expect(clearStoredSession).toHaveBeenCalledWith("acct-1", expect.anything());
  });

  it("does not re-persist an invalidated token if pairing is retried", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));
    const callbacks = capturedCallbacks();

    callbacks.onTokenResolved?.("dead-token", RELAY);
    callbacks.onSessionInvalidated?.(401);
    callbacks.onPairingComplete?.("kakao-user-1");

    expect(writeStoredSession).not.toHaveBeenCalled();
  });
});
