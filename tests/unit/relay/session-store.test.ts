/**
 * Persistent relay session store.
 *
 * Covers the defect this store exists to fix: the pairing token used to live
 * only in an in-memory Map, so a gateway restart forced the user to pair again.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = {
  register: vi.fn(),
  lookup: vi.fn(),
  delete: vi.fn(),
};

const openKeyedStore = vi.fn(() => store);

vi.mock("../../../src/runtime.js", () => ({
  getKakaoRuntime: () => ({ state: { openKeyedStore } }),
}));

const { readStoredSession, writeStoredSession, clearStoredSession, normalizeAccountKey } =
  await import("../../../src/relay/session-store");

const RELAY = "https://relay.example.com/";

describe("session-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.register.mockResolvedValue(undefined);
    store.lookup.mockResolvedValue(undefined);
    store.delete.mockResolvedValue(true);
  });

  describe("readStoredSession", () => {
    it("returns the token when a matching session is stored", async () => {
      store.lookup.mockResolvedValue({ version: 1, sessionToken: "tok-1", relayUrl: RELAY });

      await expect(readStoredSession("acct", RELAY)).resolves.toBe("tok-1");
      expect(store.lookup).toHaveBeenCalledWith("acct");
    });

    it("returns null when nothing is stored", async () => {
      await expect(readStoredSession("acct", RELAY)).resolves.toBeNull();
    });

    it("ignores a session stored for a different relay", async () => {
      store.lookup.mockResolvedValue({
        version: 1,
        sessionToken: "tok-1",
        relayUrl: "https://other-relay.example.com/",
      });

      // Replaying a token against another relay can only produce a 401.
      await expect(readStoredSession("acct", RELAY)).resolves.toBeNull();
    });

    it("treats a trailing slash difference as the same relay", async () => {
      store.lookup.mockResolvedValue({
        version: 1,
        sessionToken: "tok-1",
        relayUrl: "https://relay.example.com",
      });

      await expect(readStoredSession("acct", "https://relay.example.com/")).resolves.toBe("tok-1");
    });

    it("ignores a stored value from an older store version", async () => {
      store.lookup.mockResolvedValue({ version: 0, sessionToken: "tok-1", relayUrl: RELAY });

      await expect(readStoredSession("acct", RELAY)).resolves.toBeNull();
    });

    it.each([
      ["missing token", { version: 1, relayUrl: RELAY }],
      ["empty token", { version: 1, sessionToken: "", relayUrl: RELAY }],
      ["not an object", "nope"],
      ["null", null],
    ])("ignores a malformed stored value (%s)", async (_label, value) => {
      store.lookup.mockResolvedValue(value);

      await expect(readStoredSession("acct", RELAY)).resolves.toBeNull();
    });

    it("degrades to null when the state store throws", async () => {
      store.lookup.mockRejectedValue(new Error("sqlite is unhappy"));

      // A broken state store must cost a re-pair, never a dead channel.
      await expect(readStoredSession("acct", RELAY)).resolves.toBeNull();
    });
  });

  describe("writeStoredSession", () => {
    it("persists token, relay and version under the account key", async () => {
      await writeStoredSession("acct", "tok-1", RELAY);

      expect(store.register).toHaveBeenCalledWith("acct", {
        version: 1,
        sessionToken: "tok-1",
        relayUrl: RELAY,
      });
    });

    it("does not throw when the state store fails", async () => {
      store.register.mockRejectedValue(new Error("disk full"));

      await expect(writeStoredSession("acct", "tok-1", RELAY)).resolves.toBeUndefined();
    });
  });

  describe("clearStoredSession", () => {
    it("deletes the stored entry", async () => {
      await clearStoredSession("acct");

      expect(store.delete).toHaveBeenCalledWith("acct");
    });

    it("does not throw when the state store fails", async () => {
      store.delete.mockRejectedValue(new Error("locked"));

      await expect(clearStoredSession("acct")).resolves.toBeUndefined();
    });
  });

  describe("account keying", () => {
    it("falls back to 'default' for a blank account id", () => {
      expect(normalizeAccountKey("   ")).toBe("default");
      expect(normalizeAccountKey("")).toBe("default");
    });

    it("keeps a real account id", () => {
      expect(normalizeAccountKey(" acct ")).toBe("acct");
    });
  });

  describe("store namespace", () => {
    it("opens a plugin-owned namespace with a bounded entry count", async () => {
      await readStoredSession("acct", RELAY);

      expect(openKeyedStore).toHaveBeenCalledWith({
        namespace: "kakao-talkchannel.sessions",
        maxEntries: 100,
      });
    });
  });
});
