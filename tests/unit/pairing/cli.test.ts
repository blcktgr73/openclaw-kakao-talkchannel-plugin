import { describe, it, expect, vi } from "vitest";
import {
  CLI_COMMAND_NAME,
  GatewayUnavailableError,
  formatSnapshot,
  registerPairingCli,
} from "../../../src/pairing/cli";
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

/** Minimal commander stand-in that records the command tree and actions. */
function makeProgram() {
  const actions = new Map<string, (options: unknown) => Promise<void>>();

  function makeCommand(path: string[]) {
    const self = {
      command: (name: string) => makeCommand([...path, name]),
      description: () => self,
      option: () => self,
      argument: () => self,
      action: (handler: (options: unknown) => Promise<void>) => {
        actions.set(path.join(" "), handler);
        return self;
      },
    };
    return self;
  }

  return { program: makeCommand([]), actions };
}

function makeRuntime(overrides: Record<string, unknown> = {}) {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    gateway: {
      isAvailable: vi.fn(async () => true),
      request: vi.fn(async () => ({ account: snapshot(), accounts: [snapshot()] })),
    },
    ...overrides,
  };
}

async function registerAndGetActions(runtime: ReturnType<typeof makeRuntime>) {
  const { program, actions } = makeProgram();
  let registrar: ((ctx: unknown) => void) | undefined;

  registerPairingCli({
    runtime,
    registerCli: (fn: (ctx: unknown) => void) => {
      registrar = fn;
    },
  } as never);

  registrar!({ program, parentPath: [], config: {}, logger: runtime.logger });
  return actions;
}

describe("pairing CLI", () => {
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
      registerPairingCli({ runtime: makeRuntime(), registerCli } as never);

      const [, opts] = registerCli.mock.calls[0];
      expect(opts.commands).toEqual([CLI_COMMAND_NAME]);
      expect(opts.descriptors).toEqual([
        { name: CLI_COMMAND_NAME, description: expect.any(String), hasSubcommands: true },
      ]);
    });

    it("registers both subcommands", async () => {
      const actions = await registerAndGetActions(makeRuntime());
      expect([...actions.keys()].sort()).toEqual([
        "kakao pairing new",
        "kakao pairing status",
      ]);
    });
  });

  describe("pairing status", () => {
    it("calls the gateway method and prints the snapshot", async () => {
      const runtime = makeRuntime();
      const actions = await registerAndGetActions(runtime);

      await actions.get("kakao pairing status")!({});

      expect(runtime.gateway.request).toHaveBeenCalledWith("kakao.pairing.status", {
        accountId: undefined,
      });
      expect(runtime.logger.info).toHaveBeenCalledWith(expect.stringContaining("CODE-1234"));
    });

    it("passes through --account", async () => {
      const runtime = makeRuntime();
      const actions = await registerAndGetActions(runtime);

      await actions.get("kakao pairing status")!({ account: "acct-2" });

      expect(runtime.gateway.request).toHaveBeenCalledWith("kakao.pairing.status", {
        accountId: "acct-2",
      });
    });

    it("emits JSON with --json", async () => {
      const runtime = makeRuntime();
      const actions = await registerAndGetActions(runtime);

      await actions.get("kakao pairing status")!({ json: true });

      const output = runtime.logger.info.mock.calls[0][0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("fails with a clear message when the gateway is down", async () => {
      const runtime = makeRuntime();
      runtime.gateway.isAvailable = vi.fn(async () => false);
      const actions = await registerAndGetActions(runtime);

      // This is the requirement: pairing is only available once the gateway is up.
      await expect(actions.get("kakao pairing status")!({})).rejects.toThrow(
        GatewayUnavailableError
      );
      expect(runtime.gateway.request).not.toHaveBeenCalled();
    });
  });

  describe("pairing new", () => {
    it("sends the timeout and allows the RPC extra headroom", async () => {
      const runtime = makeRuntime();
      const actions = await registerAndGetActions(runtime);

      await actions.get("kakao pairing new")!({ timeout: "45" });

      expect(runtime.gateway.request).toHaveBeenCalledWith(
        "kakao.pairing.new",
        { accountId: undefined, timeoutMs: 45_000 },
        { timeoutMs: 60_000 }
      );
    });

    it("defaults the timeout when the flag is absent", async () => {
      const runtime = makeRuntime();
      const actions = await registerAndGetActions(runtime);

      await actions.get("kakao pairing new")!({});

      expect(runtime.gateway.request).toHaveBeenCalledWith(
        "kakao.pairing.new",
        expect.objectContaining({ timeoutMs: 30_000 }),
        expect.anything()
      );
    });

    it.each(["0", "-5", "abc"])("rejects an invalid --timeout (%s)", async (timeout) => {
      const runtime = makeRuntime();
      const actions = await registerAndGetActions(runtime);

      await expect(actions.get("kakao pairing new")!({ timeout })).rejects.toThrow(
        /--timeout must be a positive number of seconds/
      );
    });

    it("fails when the gateway is down", async () => {
      const runtime = makeRuntime();
      runtime.gateway.isAvailable = vi.fn(async () => false);
      const actions = await registerAndGetActions(runtime);

      await expect(actions.get("kakao pairing new")!({})).rejects.toThrow(
        GatewayUnavailableError
      );
    });
  });
});
