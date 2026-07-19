/**
 * Forced pairing re-issue.
 *
 * This is the behaviour the ClawHub requirement depends on: an operator over
 * SSH must be able to obtain a pairing code through the `openclaw` CLI. Before
 * this existed the only way to make a code appear was to restart the gateway —
 * restarting the very process that had to stay up, and walking into a
 * double-restart that issued two codes ~45s apart.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResolvedKakaoTalkChannel } from "../../../src/types";
import type { StreamCallbacks } from "../../../src/relay/stream";
import { gatewayAdapter } from "../../../src/adapters/gateway";
import {
  __resetPairingRegistry,
  getPairingSnapshot,
  requestNewPairing,
} from "../../../src/pairing/registry";

vi.mock("../../../src/runtime.js", () => ({
  getKakaoRuntime: () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }),
}));

vi.mock("../../../src/relay/stream.js", () => ({
  startRelayStream: vi.fn(),
}));

const forgetSessionToken = vi.fn(async () => {});
vi.mock("../../../src/relay/session-store.js", () => ({
  persistSessionToken: vi.fn(async () => {}),
  forgetSessionToken: (...args: unknown[]) => forgetSessionToken(...(args as [])),
}));

const mockLog = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function makeAccount(
  config: Partial<ResolvedKakaoTalkChannel["config"]> = {}
): ResolvedKakaoTalkChannel {
  return {
    talkchannelId: "default",
    enabled: true,
    config: {
      enabled: true,
      dmPolicy: "pairing",
      relayUrl: "https://relay.example.com/",
      ...config,
    },
  } as ResolvedKakaoTalkChannel;
}

/**
 * Drives startAccount with a stream that stays open until its signal aborts,
 * recording the account config each round was started with.
 */
async function startAccount(account: ResolvedKakaoTalkChannel) {
  const { startRelayStream } = await import("../../../src/relay/stream.js");
  const rounds: Array<{ sessionToken?: string; callbacks: StreamCallbacks }> = [];

  vi.mocked(startRelayStream).mockImplementation(
    async (roundAccount, _onMessage, signal, _opts, callbacks) => {
      rounds.push({
        sessionToken: roundAccount.config.sessionToken,
        callbacks: callbacks as StreamCallbacks,
      });
      await new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        signal.addEventListener("abort", () => resolve(), { once: true });
      });
    }
  );

  const outer = new AbortController();
  const promise = gatewayAdapter.startAccount({
    account,
    accountId: "default",
    cfg: {},
    abortSignal: outer.signal,
    log: mockLog,
  } as never);

  await Promise.resolve();
  await Promise.resolve();

  return {
    rounds,
    stop: async () => {
      outer.abort();
      await promise;
    },
  };
}

describe("pairing re-issue without a gateway restart", () => {
  let tmpHome: string;

  beforeEach(() => {
    // startAccount starts the state publisher, which writes real files.
    // Without this the suite would scribble into the developer's own
    // ~/.openclaw directory.
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "kakao-reissue-"));
    vi.stubEnv("OPENCLAW_HOME", tmpHome);

    __resetPairingRegistry();
    forgetSessionToken.mockClear();
    mockLog.info.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it("issues a new code and reports it, all while the gateway keeps running", async () => {
    const { rounds, stop } = await startAccount(makeAccount({ sessionToken: "saved-token" }));

    // Round 1 reused the saved pairing, so there is no code to read.
    expect(rounds).toHaveLength(1);
    expect(getPairingSnapshot("default")?.state).toBe("paired");

    const reissue = requestNewPairing("default", 5000);

    // The supervisor restarts the stream; round 2 must not carry the old token,
    // otherwise resolveToken short-circuits and no code is ever issued.
    await vi.waitFor(() => expect(rounds).toHaveLength(2));
    expect(rounds[1].sessionToken).toBeUndefined();

    rounds[1].callbacks.onPairingRequired?.("CODE-FRESH", 300);

    await expect(reissue).resolves.toMatchObject({
      state: "pending",
      pairingCode: "CODE-FRESH",
    });
    // And it is still readable afterwards — reads are non-destructive.
    expect(getPairingSnapshot("default")?.pairingCode).toBe("CODE-FRESH");

    await stop();
  });

  it("drops the persisted token so a restart cannot resurrect it", async () => {
    const { rounds, stop } = await startAccount(makeAccount({ sessionToken: "saved-token" }));

    const reissue = requestNewPairing("default", 5000);
    await vi.waitFor(() => expect(rounds).toHaveLength(2));
    rounds[1].callbacks.onPairingRequired?.("CODE-FRESH", 300);
    await reissue;

    expect(forgetSessionToken).toHaveBeenCalled();

    await stop();
  });

  it("tells the operator why re-issue is impossible with a static relayToken", async () => {
    const { stop } = await startAccount(makeAccount({ relayToken: "static-token" }));

    await expect(requestNewPairing("default", 5000)).rejects.toThrow(/configured relayToken/);

    await stop();
  });

  it("logs how to re-read the code instead of only printing it once", async () => {
    const { rounds, stop } = await startAccount(makeAccount());

    rounds[0].callbacks.onPairingRequired?.("CODE-1234", 300);

    const logged = mockLog.info.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("openclaw kakao pairing status");

    await stop();
  });

  it("stops the supervisor loop when the account is aborted", async () => {
    const { rounds, stop } = await startAccount(makeAccount());
    await stop();

    // No further rounds after the outer abort.
    expect(rounds).toHaveLength(1);
    expect(getPairingSnapshot("default")).toBeNull();
  });
});
