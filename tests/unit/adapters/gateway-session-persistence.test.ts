/**
 * Gateway wiring for pairing persistence.
 *
 * The pairing token used to live only in an in-memory Map, so restarting the
 * gateway threw it away and the user had to pair again with a fresh code.
 * Restoring needs no code here — the token is written into the account config,
 * which resolveToken already reads on start. What this file pins is *when* the
 * gateway saves and clears it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedKakaoTalkChannel } from "../../../src/types";
import type { StreamCallbacks } from "../../../src/relay/stream";

const startRelayStream = vi.fn().mockResolvedValue(undefined);
const persistSessionToken = vi.fn();
const forgetSessionToken = vi.fn();

vi.mock("../../../src/runtime.js", () => ({
  getKakaoRuntime: () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }),
}));

vi.mock("../../../src/relay/stream.js", () => ({
  startRelayStream: (...args: unknown[]) => startRelayStream(...args),
}));

vi.mock("../../../src/relay/session-store.js", () => ({
  persistSessionToken: (...args: unknown[]) => persistSessionToken(...args),
  forgetSessionToken: (...args: unknown[]) => forgetSessionToken(...args),
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

describe("gateway pairing persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startRelayStream.mockResolvedValue(undefined);
    persistSessionToken.mockResolvedValue(undefined);
    forgetSessionToken.mockResolvedValue(undefined);
  });

  it("saves the pairing only once the relay confirms it completed", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));
    const callbacks = capturedCallbacks();

    callbacks.onTokenResolved?.("fresh-token", RELAY);
    // Before pairing completes the relay deletes the session when its code
    // expires, so saving now would guarantee a 401 on the next start.
    expect(persistSessionToken).not.toHaveBeenCalled();

    callbacks.onPairingComplete?.("kakao-user-1");
    expect(persistSessionToken).toHaveBeenCalledWith(
      "default",
      "fresh-token",
      expect.anything()
    );
  });

  it("saves under the account's own id", async () => {
    const account = makeAccount();
    (account as unknown as { talkchannelId: string }).talkchannelId = "work";

    await gatewayAdapter.startAccount(startCtx(account));
    const callbacks = capturedCallbacks();
    callbacks.onTokenResolved?.("tok", RELAY);
    callbacks.onPairingComplete?.("kakao-user-1");

    expect(persistSessionToken).toHaveBeenCalledWith("work", "tok", expect.anything());
  });

  it("saves nothing if pairing completes without a resolved token", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));

    capturedCallbacks().onPairingComplete?.("kakao-user-1");

    expect(persistSessionToken).not.toHaveBeenCalled();
  });

  it("clears the saved pairing once the relay rejects the token", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));
    const callbacks = capturedCallbacks();

    callbacks.onTokenResolved?.("fresh-token", RELAY);
    callbacks.onSessionInvalidated?.(401);

    // Keeping it would only reproduce the rejection on the next start.
    expect(forgetSessionToken).toHaveBeenCalledWith("default", expect.anything());
  });

  it("does not re-save an invalidated token if pairing is retried", async () => {
    await gatewayAdapter.startAccount(startCtx(makeAccount()));
    const callbacks = capturedCallbacks();

    callbacks.onTokenResolved?.("dead-token", RELAY);
    callbacks.onSessionInvalidated?.(401);
    callbacks.onPairingComplete?.("kakao-user-1");

    expect(persistSessionToken).not.toHaveBeenCalled();
  });

  it("reports that a saved pairing is being reused instead of issuing a code", async () => {
    const ctx = startCtx(makeAccount({ sessionToken: "saved-token" }));

    await gatewayAdapter.startAccount(ctx);

    const log = (ctx as unknown as { log: { info: ReturnType<typeof vi.fn> } }).log;
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("Reusing the saved pairing"));
  });
});
