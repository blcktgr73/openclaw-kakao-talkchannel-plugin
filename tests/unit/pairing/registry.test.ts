/**
 * Pairing registry tests.
 *
 * These lock the three properties the registry exists to guarantee:
 * non-destructive reads, cleanup on terminal states, and deduplication of the
 * repeated `pairing_complete` events the relay sends.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  __resetPairingRegistry,
  awaitPairingCode,
  getPairingSnapshot,
  listPairingSnapshots,
  recordPairingComplete,
  recordPairingExpired,
  recordPairingRequired,
  recordSessionInvalidated,
  recordSessionReused,
  registerAccount,
  requestNewPairing,
  unregisterAccount,
  type AccountController,
} from "../../../src/pairing/registry";

const ACCOUNT = "default";
const TALKCHANNEL = "default";

function makeController(overrides: Partial<AccountController> = {}): AccountController {
  return {
    reissueBlockedReason: () => null,
    requestNewPairing: vi.fn(async () => getPairingSnapshot(ACCOUNT)!),
    ...overrides,
  };
}

describe("pairing registry", () => {
  beforeEach(() => {
    __resetPairingRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("reads", () => {
    it("returns null for an unknown account", () => {
      expect(getPairingSnapshot("nope")).toBeNull();
    });

    it("is non-destructive", () => {
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);

      expect(getPairingSnapshot(ACCOUNT)?.pairingCode).toBe("CODE-1234");
      expect(getPairingSnapshot(ACCOUNT)?.pairingCode).toBe("CODE-1234");
      expect(getPairingSnapshot(ACCOUNT)?.pairingCode).toBe("CODE-1234");
    });

    it("falls back to the first account when no id is given", () => {
      recordPairingRequired("first", "first", "CODE-A", 300);
      recordPairingRequired("second", "second", "CODE-B", 300);

      expect(getPairingSnapshot()?.accountId).toBe("first");
    });

    it("lists every known account", () => {
      recordPairingRequired("a", "a", "CODE-A", 300);
      recordPairingRequired("b", "b", "CODE-B", 300);

      expect(listPairingSnapshots().map((snapshot) => snapshot.accountId).sort()).toEqual([
        "a",
        "b",
      ]);
    });
  });

  describe("state transitions", () => {
    it("reports a pending code with a live countdown", () => {
      vi.useFakeTimers();
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);

      expect(getPairingSnapshot(ACCOUNT)?.expiresInSeconds).toBe(300);

      vi.advanceTimersByTime(120_000);
      expect(getPairingSnapshot(ACCOUNT)?.expiresInSeconds).toBe(180);
    });

    it("reads as expired once the code runs out, without waiting for the relay", () => {
      vi.useFakeTimers();
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);

      vi.advanceTimersByTime(301_000);

      const snapshot = getPairingSnapshot(ACCOUNT)!;
      expect(snapshot.state).toBe("expired");
      // A dead code must never be handed to an operator.
      expect(snapshot.pairingCode).toBeNull();
    });

    it("clears the code when pairing completes", () => {
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);
      recordPairingComplete(ACCOUNT, TALKCHANNEL, "kakao-user-1");

      const snapshot = getPairingSnapshot(ACCOUNT)!;
      expect(snapshot.state).toBe("paired");
      expect(snapshot.pairingCode).toBeNull();
      expect(snapshot.pairedUserId).toBe("kakao-user-1");
    });

    it("clears the code when pairing expires", () => {
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);
      recordPairingExpired(ACCOUNT, TALKCHANNEL);

      const snapshot = getPairingSnapshot(ACCOUNT)!;
      expect(snapshot.state).toBe("expired");
      expect(snapshot.pairingCode).toBeNull();
    });

    it("marks an account paired when a saved session is reused", () => {
      recordSessionReused(ACCOUNT, TALKCHANNEL);
      expect(getPairingSnapshot(ACCOUNT)?.state).toBe("paired");
    });

    it("does not let a reused session mask a pending code", () => {
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);
      recordSessionReused(ACCOUNT, TALKCHANNEL);

      expect(getPairingSnapshot(ACCOUNT)?.state).toBe("pending");
    });

    it("drops paired state when the relay invalidates the session", () => {
      recordPairingComplete(ACCOUNT, TALKCHANNEL, "kakao-user-1");
      recordSessionInvalidated(ACCOUNT, TALKCHANNEL);

      const snapshot = getPairingSnapshot(ACCOUNT)!;
      expect(snapshot.state).toBe("unpaired");
      expect(snapshot.pairedUserId).toBeNull();
    });

    it("forgets everything once the account is unregistered", () => {
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);
      unregisterAccount(ACCOUNT);

      expect(getPairingSnapshot(ACCOUNT)).toBeNull();
    });
  });

  describe("pairing_complete deduplication", () => {
    // The relay delivers this ~4x in 2s. Each one used to rewrite openclaw.json.
    it("reports only the first completion as new", () => {
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);

      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-1")).toBe(true);
      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-1")).toBe(false);
      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-1")).toBe(false);
      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-1")).toBe(false);
    });

    it("treats a different user as a new completion", () => {
      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-1")).toBe(true);
      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-2")).toBe(true);
    });

    it("treats a later re-pair of the same user as new", () => {
      vi.useFakeTimers();
      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-1")).toBe(true);

      vi.advanceTimersByTime(11_000);
      expect(recordPairingComplete(ACCOUNT, TALKCHANNEL, "user-1")).toBe(true);
    });
  });

  describe("awaitPairingCode", () => {
    it("resolves when a code is issued", async () => {
      const pending = awaitPairingCode(ACCOUNT, 1000);
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-LATER", 300);

      await expect(pending).resolves.toMatchObject({ pairingCode: "CODE-LATER" });
    });

    it("rejects on timeout", async () => {
      vi.useFakeTimers();
      const pending = awaitPairingCode(ACCOUNT, 500);
      const assertion = expect(pending).rejects.toThrow(/Timed out after 500ms/);

      await vi.advanceTimersByTimeAsync(600);
      await assertion;
    });

    it("resolves waiters instead of hanging when the account goes away", async () => {
      const pending = awaitPairingCode(ACCOUNT, 5000);
      unregisterAccount(ACCOUNT);

      await expect(pending).resolves.toMatchObject({ accountId: ACCOUNT });
    });
  });

  describe("requestNewPairing", () => {
    it("fails when no account is running", async () => {
      await expect(requestNewPairing(undefined, 1000)).rejects.toThrow(
        /No Kakao account is running/
      );
    });

    it("fails for an unknown account id", async () => {
      registerAccount(ACCOUNT, TALKCHANNEL, makeController());
      await expect(requestNewPairing("other", 1000)).rejects.toThrow(/Unknown Kakao account/);
    });

    it("fails when re-issue is blocked", async () => {
      registerAccount(
        ACCOUNT,
        TALKCHANNEL,
        makeController({ reissueBlockedReason: () => "uses a configured relayToken" })
      );

      await expect(requestNewPairing(ACCOUNT, 1000)).rejects.toThrow(
        /uses a configured relayToken/
      );
    });

    it("delegates to the account controller", async () => {
      const controller = makeController();
      registerAccount(ACCOUNT, TALKCHANNEL, controller);
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-NEW", 300);

      await requestNewPairing(ACCOUNT, 4321);

      expect(controller.requestNewPairing).toHaveBeenCalledWith(4321);
    });
  });

  describe("canReissue", () => {
    it("is false for an account that is not running", () => {
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);

      const snapshot = getPairingSnapshot(ACCOUNT)!;
      expect(snapshot.canReissue).toBe(false);
      expect(snapshot.reissueBlockedReason).toBe("account is not running");
    });

    it("is true for a running account with no static token", () => {
      registerAccount(ACCOUNT, TALKCHANNEL, makeController());
      recordPairingRequired(ACCOUNT, TALKCHANNEL, "CODE-1234", 300);

      expect(getPairingSnapshot(ACCOUNT)?.canReissue).toBe(true);
    });
  });
});
