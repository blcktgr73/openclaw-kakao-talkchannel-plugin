/**
 * Pairing persistence.
 *
 * The pairing token used to live only in an in-memory Map, so a gateway
 * restart threw it away and the user had to pair again. It is now written into
 * the account's own config entry — the same place resolveToken already reads.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mutateConfigFile = vi.fn();

vi.mock("../../../src/runtime.js", () => ({
  getKakaoRuntime: () => ({ config: { mutateConfigFile } }),
}));

const { persistSessionToken, forgetSessionToken } = await import(
  "../../../src/relay/session-store"
);

/** Runs the recorded mutation against a draft and returns the result. */
async function applyMutation(draft: Record<string, unknown>) {
  const params = mutateConfigFile.mock.calls[0][0];
  await params.mutate(draft);
  return draft;
}

function accountIn(draft: Record<string, unknown>, id = "default") {
  const channels = draft.channels as Record<string, Record<string, Record<string, unknown>>>;
  return channels["kakao-talkchannel"].accounts[id] as Record<string, unknown>;
}

describe("pairing persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateConfigFile.mockResolvedValue({});
  });

  describe("persistSessionToken", () => {
    it("writes the token under the account's config entry", async () => {
      await persistSessionToken("default", "tok-1");

      const draft = await applyMutation({});
      expect(accountIn(draft).sessionToken).toBe("tok-1");
    });

    it("keeps other settings on the same account", async () => {
      await persistSessionToken("default", "tok-1");

      const draft = await applyMutation({
        channels: {
          "kakao-talkchannel": {
            accounts: { default: { enabled: true, dmPolicy: "pairing" } },
          },
        },
      });

      expect(accountIn(draft)).toEqual({
        enabled: true,
        dmPolicy: "pairing",
        sessionToken: "tok-1",
      });
    });

    it("does not disturb other channels", async () => {
      await persistSessionToken("default", "tok-1");

      const draft = await applyMutation({
        channels: { telegram: { accounts: { default: { botToken: "keep-me" } } } },
      });

      const channels = draft.channels as Record<string, unknown>;
      expect(channels.telegram).toEqual({ accounts: { default: { botToken: "keep-me" } } });
    });

    it("writes to the named account, not always 'default'", async () => {
      await persistSessionToken("work", "tok-work");

      const draft = await applyMutation({});
      expect(accountIn(draft, "work").sessionToken).toBe("tok-work");
    });

    it("never asks the gateway to reload or restart", async () => {
      await persistSessionToken("default", "tok-1");

      // Restarting from inside the pairing flow would loop, and the running
      // process already holds this token, so a reload buys nothing.
      expect(mutateConfigFile.mock.calls[0][0].afterWrite).toEqual({
        mode: "none",
        reason: expect.any(String),
      });
    });

    it("does not throw when the config write fails", async () => {
      mutateConfigFile.mockRejectedValue(new Error("config is read-only"));
      const log = { info: vi.fn(), warn: vi.fn() };

      await expect(persistSessionToken("default", "tok-1", log)).resolves.toBeUndefined();
      // The user has to know a restart will cost them a re-pair.
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("Could not save the pairing"));
    });
  });

  describe("forgetSessionToken", () => {
    it("removes the token from the account entry", async () => {
      await forgetSessionToken("default");

      const draft = await applyMutation({
        channels: {
          "kakao-talkchannel": {
            accounts: { default: { enabled: true, sessionToken: "tok-1" } },
          },
        },
      });

      expect(accountIn(draft)).toEqual({ enabled: true });
    });

    it("is a no-op when nothing was stored", async () => {
      await forgetSessionToken("default");

      const draft = await applyMutation({});
      expect(accountIn(draft)).toEqual({});
    });

    it("does not throw when the config write fails", async () => {
      mutateConfigFile.mockRejectedValue(new Error("locked"));

      await expect(forgetSessionToken("default")).resolves.toBeUndefined();
    });
  });
});
