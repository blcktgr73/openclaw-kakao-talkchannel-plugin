import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CLI_COMMAND_NAME,
  GatewayNotPublishingError,
  StaleStateError,
  formatSnapshot,
  registerPairingCli,
} from "../../../src/pairing/cli";
import type { PairingSnapshot } from "../../../src/pairing/registry";
import { writePairingState, resolveStateDir, REQUEST_FILE } from "../../../src/pairing/state-file";

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

/** Minimal commander stand-in that records the command tree and actions. */
function makeProgram() {
  const actions = new Map<string, (options: unknown) => Promise<void>>();

  function makeCommand(cmdPath: string[]) {
    const self = {
      command: (name: string) => makeCommand([...cmdPath, name]),
      description: () => self,
      option: () => self,
      argument: () => self,
      action: (handler: (options: unknown) => Promise<void>) => {
        actions.set(cmdPath.join(" "), handler);
        return self;
      },
    };
    return self;
  }

  return { program: makeCommand([]), actions };
}

function registerAndGetActions() {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const { program, actions } = makeProgram();
  let registrar: ((ctx: unknown) => void) | undefined;

  registerPairingCli({
    registerCli: (fn: (ctx: unknown) => void) => {
      registrar = fn;
    },
  } as never);

  registrar!({ program, parentPath: [], config: {}, logger });
  return { actions, logger };
}

describe("pairing CLI", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "kakao-cli-"));
    vi.stubEnv("OPENCLAW_HOME", tmpHome);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  describe("formatSnapshot", () => {
    it("explains that the gateway must be up when nothing is running", () => {
      const output = formatSnapshot(null);
      expect(output).toContain("No KakaoTalk account is running");
      expect(output).toContain("openclaw gateway status");
    });

    it("shows the code and the /pair instruction while pending", () => {
      const output = formatSnapshot(snapshot({ expiresInSeconds: 185 }));
      expect(output).toContain("CODE-1234");
      expect(output).toContain("/pair CODE-1234");
      expect(output).toContain("3분 5초");
    });

    it("does not show a code once paired", () => {
      const output = formatSnapshot(
        snapshot({ state: "paired", pairingCode: null, pairedUserId: "user-1" })
      );
      expect(output).not.toContain("CODE-1234");
      expect(output).toContain("paired");
      expect(output).toContain("user-1");
    });

    it("handles a paired account with no recorded user", () => {
      // Happens when a saved session token was restored rather than paired.
      const output = formatSnapshot(
        snapshot({ state: "paired", pairingCode: null, pairedUserId: null })
      );
      expect(output).toContain("state: paired");
      expect(output).not.toContain("(null)");
    });

    it("points at `pairing new` when expired or unpaired", () => {
      expect(formatSnapshot(snapshot({ state: "expired", pairingCode: null }))).toContain(
        "openclaw kakao pairing new"
      );
      expect(formatSnapshot(snapshot({ state: "unpaired", pairingCode: null }))).toContain(
        "openclaw kakao pairing new"
      );
    });

    it("surfaces why re-issue is unavailable", () => {
      const output = formatSnapshot(
        snapshot({ canReissue: false, reissueBlockedReason: "uses a configured relayToken" })
      );
      expect(output).toContain("uses a configured relayToken");
    });
  });

  describe("registration", () => {
    it("declares the mandatory command metadata", () => {
      const registerCli = vi.fn();
      registerPairingCli({ registerCli } as never);

      const [, opts] = registerCli.mock.calls[0];
      expect(opts.commands).toEqual([CLI_COMMAND_NAME]);
      expect(opts.descriptors).toEqual([
        { name: CLI_COMMAND_NAME, description: expect.any(String), hasSubcommands: true },
      ]);
    });

    it("registers both subcommands", () => {
      const { actions } = registerAndGetActions();
      expect([...actions.keys()].sort()).toEqual(["kakao pairing new", "kakao pairing status"]);
    });
  });

  describe("pairing status", () => {
    it("reads the published state file", async () => {
      writePairingState([snapshot()]);
      const { actions, logger } = registerAndGetActions();

      await actions.get("kakao pairing status")!({});

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("CODE-1234"));
    });

    it("selects the requested account", async () => {
      writePairingState([
        snapshot({ accountId: "a", pairingCode: "CODE-A" }),
        snapshot({ accountId: "b", pairingCode: "CODE-B" }),
      ]);
      const { actions, logger } = registerAndGetActions();

      await actions.get("kakao pairing status")!({ account: "b" });

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("CODE-B"));
    });

    it("emits parseable JSON on raw stdout with --json", async () => {
      // The logger prefixes every line with a timestamp and [plugins], which
      // would make `... --json | jq .` fail. Machine output must bypass it.
      writePairingState([snapshot()]);
      const { actions, logger } = registerAndGetActions();

      const written: string[] = [];
      const spy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation((chunk: string | Uint8Array) => {
          written.push(String(chunk));
          return true;
        });

      try {
        await actions.get("kakao pairing status")!({ json: true });
      } finally {
        spy.mockRestore();
      }

      expect(logger.info).not.toHaveBeenCalled();
      const output = written.join("");
      expect(() => JSON.parse(output)).not.toThrow();
      expect(JSON.parse(output).account.pairingCode).toBe("CODE-1234");
    });

    it("is non-destructive — repeated reads return the same code", async () => {
      writePairingState([snapshot()]);
      const { actions, logger } = registerAndGetActions();

      await actions.get("kakao pairing status")!({});
      await actions.get("kakao pairing status")!({});
      await actions.get("kakao pairing status")!({});

      const outputs = logger.info.mock.calls.map((call) => call[0] as string);
      expect(outputs).toHaveLength(3);
      for (const output of outputs) expect(output).toContain("CODE-1234");
    });

    it("explains when nothing is publishing", async () => {
      const { actions } = registerAndGetActions();

      await expect(actions.get("kakao pairing status")!({})).rejects.toThrow(
        GatewayNotPublishingError
      );
    });

    it("rejects state left behind by a dead gateway", async () => {
      // A pid that cannot be alive, so the staleness check trips regardless of
      // how recently the file was written.
      const state = {
        pid: 0,
        updatedAt: Date.now(),
        accounts: [snapshot()],
      };
      const dir = resolveStateDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "pairing-state.json"), JSON.stringify(state));

      const { actions } = registerAndGetActions();

      await expect(actions.get("kakao pairing status")!({})).rejects.toThrow(StaleStateError);
    });
  });

  describe("pairing new", () => {
    it("writes a request the gateway can consume", async () => {
      writePairingState([snapshot({ state: "paired", pairingCode: null })]);
      const { actions } = registerAndGetActions();

      // Do not await — the command polls until a new code appears.
      const pending = actions.get("kakao pairing new")!({ timeout: "0.5" }).catch(() => {});

      await vi.waitFor(() => {
        const request = path.join(resolveStateDir(), REQUEST_FILE);
        expect(fs.existsSync(request)).toBe(true);
      });

      const request = JSON.parse(
        fs.readFileSync(path.join(resolveStateDir(), REQUEST_FILE), "utf8")
      );
      expect(request.timeoutMs).toBe(500);
      expect(request.id).toEqual(expect.any(String));

      await pending;
    });

    it("returns the code once the gateway publishes a newer one", async () => {
      writePairingState([snapshot({ state: "paired", pairingCode: null, issuedAt: null })]);
      const { actions, logger } = registerAndGetActions();

      const pending = actions.get("kakao pairing new")!({ timeout: "5" });

      // Simulate the gateway honouring the request.
      await vi.waitFor(() =>
        expect(fs.existsSync(path.join(resolveStateDir(), REQUEST_FILE))).toBe(true)
      );
      writePairingState([snapshot({ pairingCode: "CODE-FRESH", issuedAt: Date.now() })]);

      await pending;
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("CODE-FRESH"));
    });

    it("ignores a stale code that predates the request", async () => {
      // An old pending code must not be mistaken for the newly issued one.
      writePairingState([snapshot({ pairingCode: "CODE-OLD", issuedAt: Date.now() - 60_000 })]);
      const { actions } = registerAndGetActions();

      await expect(actions.get("kakao pairing new")!({ timeout: "0.5" })).rejects.toThrow(
        /Timed out/
      );
    });

    it.each(["0", "-5", "abc"])("rejects an invalid --timeout (%s)", async (timeout) => {
      writePairingState([snapshot()]);
      const { actions } = registerAndGetActions();

      await expect(actions.get("kakao pairing new")!({ timeout })).rejects.toThrow(
        /--timeout must be a positive number of seconds/
      );
    });

    it("fails fast when nothing is publishing", async () => {
      const { actions } = registerAndGetActions();

      await expect(actions.get("kakao pairing new")!({})).rejects.toThrow(
        GatewayNotPublishingError
      );
      // No request should be left behind for a gateway that is not there.
      expect(fs.existsSync(path.join(resolveStateDir(), REQUEST_FILE))).toBe(false);
    });
  });
});
