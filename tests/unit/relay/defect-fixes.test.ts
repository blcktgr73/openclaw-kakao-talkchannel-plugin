/**
 * Regression tests for the relay client defects fixed alongside the pairing CLI.
 *
 * Each of these previously behaved the other way; see docs/known-relay-defects.md
 * in the Hermes port for the shared catalogue (D1/D3/D6).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateReconnectDelay } from "../../../src/relay/sse";
import { healthCheck } from "../../../src/relay/client";
import { createSession, checkSessionStatus, normalizeRelayUrl } from "../../../src/relay/session";

describe("relay defect fixes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("D1 — health check URL normalization", () => {
    function stubFetch() {
      const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    it("does not emit a double slash for a relayUrl that ends in one", async () => {
      const fetchMock = stubFetch();

      await healthCheck({ relayUrl: "https://relay.example/", relayToken: "tok" });

      expect(fetchMock.mock.calls[0][0]).toBe("https://relay.example/health");
    });

    it("still appends a slash when the relayUrl lacks one", async () => {
      const fetchMock = stubFetch();

      await healthCheck({ relayUrl: "https://relay.example", relayToken: "tok" });

      expect(fetchMock.mock.calls[0][0]).toBe("https://relay.example/health");
    });

    it("matches the default relay URL shape", () => {
      // The shipped default ends in a slash, which is what produced //health.
      expect(normalizeRelayUrl("https://k.tess.dev/")).toBe("https://k.tess.dev/");
    });
  });

  describe("D3 — reconnect jitter must not exceed the cap", () => {
    it("never returns more than maxDelayMs", () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        for (let sample = 0; sample < 25; sample += 1) {
          expect(calculateReconnectDelay(attempt, 1000, 30_000)).toBeLessThanOrEqual(30_000);
        }
      }
    });

    it("still grows exponentially below the cap", () => {
      vi.spyOn(Math, "random").mockReturnValue(0);

      expect(calculateReconnectDelay(1, 1000, 30_000)).toBe(2000);
      expect(calculateReconnectDelay(2, 1000, 30_000)).toBe(4000);
      expect(calculateReconnectDelay(3, 1000, 30_000)).toBe(8000);
    });

    it("still applies jitter", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      // 2000 + (2000 * 0.2 * 0.5) = 2200
      expect(calculateReconnectDelay(1, 1000, 30_000)).toBe(2200);
    });

    it("saturates exactly at the cap", () => {
      vi.spyOn(Math, "random").mockReturnValue(1);

      expect(calculateReconnectDelay(20, 1000, 30_000)).toBe(30_000);
    });
  });

  describe("D6 — session calls carry a timeout", () => {
    it("passes an abort signal when creating a session", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              sessionToken: "tok",
              pairingCode: "CODE",
              expiresIn: 300,
              status: "pending_pairing",
            }),
            { status: 200 }
          )
      );
      vi.stubGlobal("fetch", fetchMock);

      await createSession("https://relay.example/");

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("passes an abort signal when checking session status", async () => {
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify({ status: "paired" }), { status: 200 })
      );
      vi.stubGlobal("fetch", fetchMock);

      await checkSessionStatus("tok", "https://relay.example/");

      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("URL-encodes the session token in the status path", async () => {
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify({ status: "paired" }), { status: 200 })
      );
      vi.stubGlobal("fetch", fetchMock);

      await checkSessionStatus("tok/with?chars", "https://relay.example/");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://relay.example/v1/sessions/tok%2Fwith%3Fchars/status"
      );
    });
  });
});
