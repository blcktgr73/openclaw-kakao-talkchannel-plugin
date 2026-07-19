/**
 * Reconnect-on-pairing-complete.
 *
 * The relay decides which channel a stream subscribes to — the pairing session
 * or the paired account — when the connection is established. So a stream that
 * was opened before pairing stays subscribed to the pairing session, and any
 * message published to the account channel afterwards has no listener.
 *
 * Previously the client only noticed on the next reconnect, which happened
 * because the relay force-closed the stream every 60s. Relying on that is what
 * broke delivery on 2026-07-19: removing the relay-side timeout left the stream
 * open, the transition never happened, and messages sat queued unanswered.
 *
 * These tests pin the client-side behaviour so it no longer depends on the
 * server recycling the connection.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { connectSSE } from "../../../src/relay/sse";

const encoder = new TextEncoder();

/**
 * A body whose reader yields the given chunks and then stays open.
 *
 * The server never closes it, so only a client-side decision can end the
 * connection. `signal` mirrors what real fetch does: aborting the request
 * tears down the body, which surfaces as the read completing.
 */
function openStreamOf(chunks: string[], signal?: AbortSignal) {
  let index = 0;
  return {
    getReader: () => ({
      read: () => {
        if (index < chunks.length) {
          return Promise.resolve({ done: false, value: encoder.encode(chunks[index++]) });
        }
        return new Promise<{ done: boolean; value?: Uint8Array }>((resolve) => {
          if (!signal) return;
          if (signal.aborted) {
            resolve({ done: true });
            return;
          }
          signal.addEventListener("abort", () => resolve({ done: true }), { once: true });
        });
      },
      cancel: () => Promise.resolve(),
    }),
  };
}

const PAIRING_COMPLETE_CHUNK =
  'event: pairing_complete\ndata: {"kakaoUserId":"user-123"}\n\n';
const MESSAGE_CHUNK =
  'event: message\ndata: {"id":"m1","normalized":{"text":"hi"}}\n\n';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function okResponse(body: ReturnType<typeof openStreamOf>) {
  return { ok: true, status: 200, body };
}

describe("connectSSE — pairing completion", () => {
  it("reconnects immediately instead of waiting for the server to close the stream", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn();

    // 1st connection: pairing completes, then the stream stays open.
    fetchMock.mockResolvedValueOnce(okResponse(openStreamOf([PAIRING_COMPLETE_CHUNK])));
    // 2nd connection proves the client reconnected on its own. End the test here.
    fetchMock.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(okResponse(openStreamOf([])));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const onPairingComplete = vi.fn();

    // Safety net: if the reconnect never happens this abort ends the test with
    // a single fetch call, which is exactly the regression we are guarding.
    const safety = setTimeout(() => controller.abort(), 2000);
    try {
      await connectSSE(
        { relayUrl: "https://relay.example.com/", sessionToken: "tok", timeoutMs: 60_000 },
        { onMessage: vi.fn(), onPairingComplete },
        controller.signal
      );
    } finally {
      clearTimeout(safety);
    }

    expect(onPairingComplete).toHaveBeenCalledTimes(1);
    expect(onPairingComplete).toHaveBeenCalledWith({ kakaoUserId: "user-123" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not reconnect while no pairing event arrives", async () => {
    const controller = new AbortController();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(openStreamOf([MESSAGE_CHUNK], controller.signal)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const onMessage = vi.fn().mockResolvedValue(undefined);

    const safety = setTimeout(() => controller.abort(), 300);
    try {
      await connectSSE(
        { relayUrl: "https://relay.example.com/", sessionToken: "tok", timeoutMs: 60_000 },
        { onMessage },
        controller.signal
      );
    } finally {
      clearTimeout(safety);
    }

    // An ordinary message must not churn the connection.
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("delivers events that arrived in the same chunk as the pairing event", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce(
      // Pairing and a message in one chunk: leaving the read loop must not
      // discard events already parsed alongside the pairing event.
      okResponse(openStreamOf([PAIRING_COMPLETE_CHUNK + MESSAGE_CHUNK]))
    );
    fetchMock.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(okResponse(openStreamOf([])));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const onMessage = vi.fn().mockResolvedValue(undefined);

    const safety = setTimeout(() => controller.abort(), 2000);
    try {
      await connectSSE(
        { relayUrl: "https://relay.example.com/", sessionToken: "tok", timeoutMs: 60_000 },
        { onMessage, onPairingComplete: vi.fn() },
        controller.signal
      );
    } finally {
      clearTimeout(safety);
    }

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
