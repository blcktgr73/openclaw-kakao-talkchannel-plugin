import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  REQUEST_FILE,
  STATE_FILE,
  clearPairingRequest,
  clearPairingState,
  consumePairingRequest,
  describeStaleness,
  isStateStale,
  readPairingState,
  resolveStateDir,
  writePairingRequest,
  writePairingState,
  type PairingStateFile,
} from "../../../src/pairing/state-file";
import type { PairingSnapshot } from "../../../src/pairing/registry";

function snapshot(overrides: Partial<PairingSnapshot> = {}): PairingSnapshot {
  return {
    accountId: "default",
    talkchannelId: "default",
    state: "pending",
    pairingCode: "CODE-1234",
    expiresAt: Date.now() + 300_000,
    expiresInSeconds: 300,
    issuedAt: Date.now(),
    pairedUserId: null,
    pairedAt: null,
    canReissue: true,
    reissueBlockedReason: null,
    ...overrides,
  };
}

describe("pairing state file", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "kakao-state-"));
    vi.stubEnv("OPENCLAW_HOME", tmpHome);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  describe("location", () => {
    it("lives under OPENCLAW_HOME/.openclaw", () => {
      expect(resolveStateDir()).toBe(path.join(tmpHome, ".openclaw", "kakao-talkchannel"));
    });
  });

  describe("state", () => {
    it("round-trips", () => {
      writePairingState([snapshot()]);
      const state = readPairingState();

      expect(state?.accounts[0].pairingCode).toBe("CODE-1234");
      expect(state?.pid).toBe(process.pid);
      expect(state?.updatedAt).toBeGreaterThan(0);
    });

    it("returns null when absent", () => {
      expect(readPairingState()).toBeNull();
    });

    it("returns null rather than throwing on corrupt content", () => {
      const dir = resolveStateDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, STATE_FILE), "{ not json");

      expect(readPairingState()).toBeNull();
    });

    it("overwrites cleanly on repeated writes", () => {
      writePairingState([snapshot({ pairingCode: "CODE-A" })]);
      writePairingState([snapshot({ pairingCode: "CODE-B" })]);

      expect(readPairingState()?.accounts).toHaveLength(1);
      expect(readPairingState()?.accounts[0].pairingCode).toBe("CODE-B");
    });

    it("leaves no temp files behind", () => {
      writePairingState([snapshot()]);
      const leftovers = fs.readdirSync(resolveStateDir()).filter((f) => f.endsWith(".tmp"));
      expect(leftovers).toEqual([]);
    });

    it("clears", () => {
      writePairingState([snapshot()]);
      clearPairingState();
      expect(readPairingState()).toBeNull();
    });

    it("is restricted to the owner on POSIX", () => {
      writePairingState([snapshot()]);
      if (process.platform === "win32") return; // chmod is a no-op there

      const mode = fs.statSync(path.join(resolveStateDir(), STATE_FILE)).mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe("staleness", () => {
    const base = (overrides: Partial<PairingStateFile> = {}): PairingStateFile => ({
      pid: process.pid,
      updatedAt: Date.now(),
      accounts: [],
      ...overrides,
    });

    it("accepts a fresh file from a live process", () => {
      expect(isStateStale(base())).toBe(false);
    });

    it("tolerates a quiet file while its writer is alive", () => {
      // Publishing is event-driven plus a heartbeat; a couple of minutes of
      // silence is normal for a stable pairing and must not read as dead.
      expect(isStateStale(base({ updatedAt: Date.now() - 120_000 }))).toBe(false);
    });

    it("rejects a file far older than the backstop window", () => {
      // Guards the case where a pid has been recycled onto an unrelated process.
      expect(isStateStale(base({ updatedAt: Date.now() - 20 * 60_000 }))).toBe(true);
    });

    describe("reason reporting", () => {
      // The old code short-circuited on age and never checked the pid, while
      // its caller's message claimed the process was dead. On the VM that sent
      // us hunting a gateway crash that had not happened.
      it("reports a live writer as not stale, with no reason", () => {
        expect(describeStaleness(base())).toMatchObject({ stale: false, reason: null });
      });

      it("reports writer-gone only when the pid was actually checked and failed", () => {
        expect(describeStaleness(base({ pid: 0 }))).toMatchObject({
          stale: true,
          reason: "writer-gone",
        });
      });

      it("reports too-old when the writer is alive but the file has aged out", () => {
        const result = describeStaleness(base({ updatedAt: Date.now() - 20 * 60_000 }));
        expect(result).toMatchObject({ stale: true, reason: "too-old" });
        // Crucially NOT writer-gone: this process is alive.
        expect(result.reason).not.toBe("writer-gone");
      });

      it("always reports the observed age", () => {
        expect(describeStaleness(base({ updatedAt: Date.now() - 5000 })).ageMs).toBeGreaterThanOrEqual(
          5000
        );
      });
    });

    it("rejects a file whose writer is gone", () => {
      // pid 0 can never be a live writer here.
      expect(isStateStale(base({ pid: 0 }))).toBe(true);
    });

    it("rejects a nonsense pid", () => {
      expect(isStateStale(base({ pid: -1 }))).toBe(true);
    });
  });

  describe("request", () => {
    it("round-trips and is consumed exactly once", () => {
      const written = writePairingRequest("acct", 5000);

      const consumed = consumePairingRequest();
      expect(consumed?.id).toBe(written.id);
      expect(consumed?.accountId).toBe("acct");
      expect(consumed?.timeoutMs).toBe(5000);

      // Consuming deletes it, so a request cannot be replayed.
      expect(consumePairingRequest()).toBeNull();
    });

    it("returns null when there is nothing pending", () => {
      expect(consumePairingRequest()).toBeNull();
    });

    it("carries no accountId when none is given", () => {
      writePairingRequest(undefined, 1000);
      expect(consumePairingRequest()?.accountId).toBeUndefined();
    });

    it("clears without consuming", () => {
      writePairingRequest("acct", 1000);
      clearPairingRequest();
      expect(fs.existsSync(path.join(resolveStateDir(), REQUEST_FILE))).toBe(false);
    });

    it("removes a corrupt request rather than leaving it to loop forever", () => {
      const dir = resolveStateDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, REQUEST_FILE), "{ not json");

      expect(consumePairingRequest()).toBeNull();
      expect(fs.existsSync(path.join(dir, REQUEST_FILE))).toBe(false);
    });
  });
});
