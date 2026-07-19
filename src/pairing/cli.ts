/**
 * `openclaw kakao pairing …` CLI commands.
 *
 * This is the operator-facing answer to "how do I get the pairing code over
 * SSH?". Before this existed the only way was to restart the gateway and grep
 * journald inside a five-minute window — which meant restarting the very thing
 * that had to stay up, and stepping around a double-restart that issued two
 * codes ~45s apart.
 *
 * ## Why this talks to files, not to the gateway
 *
 * The obvious design — have the CLI call a gateway RPC method — does not work.
 * `runtime.gateway.isAvailable()` reports "whether this process owns an active
 * Gateway request context", which is true only for plugin code already running
 * *inside* the gateway; from the CLI it is always false. The host's own
 * `callGateway` helper is not exported from `openclaw/plugin-sdk`. Verified on
 * a live gateway 2026-07-20.
 *
 * So the gateway publishes pairing state to `pairing-state.json` and consumes
 * re-issue requests from `pairing-request.json`. The RPC methods still exist and
 * work (`openclaw gateway call kakao.pairing.status`) — they are just not
 * reachable from a plugin's own CLI command.
 */

import type { OpenClawPluginApi, OpenClawPluginCliContext } from "openclaw/plugin-sdk";
import type { PairingSnapshot } from "./registry.js";
import {
  isStateStale,
  readPairingState,
  writePairingRequest,
  type PairingStateFile,
} from "./state-file.js";

export const CLI_COMMAND_NAME = "kakao";

export const DEFAULT_REISSUE_TIMEOUT_SECONDS = 30;
/** How often the CLI re-reads the state file while waiting for a new code. */
export const POLL_INTERVAL_MS = 500;
/**
 * Extra wait on top of `--timeout`, covering the gateway's own request poll
 * interval. The relay round trip is already what `--timeout` budgets for.
 */
export const REISSUE_POLL_GRACE_MS = 2000;

interface CliOptions {
  account?: string;
  json?: boolean;
  timeout?: string;
}

export class GatewayNotPublishingError extends Error {
  constructor() {
    super(
      "No KakaoTalk pairing state found. The gateway publishes it only while a " +
        "KakaoTalk account is running.\n" +
        "  Check:  openclaw gateway status\n" +
        "          openclaw channels status --channel kakao-talkchannel"
    );
    this.name = "GatewayNotPublishingError";
  }
}

export function staleWarning(state: PairingStateFile): string {
  const ageSeconds = Math.round((Date.now() - state.updatedAt) / 1000);
  return (
    `warning: this pairing state may be out of date — last written ${ageSeconds}s ` +
    `ago by pid ${state.pid}, which no longer appears to be running.\n` +
    "  Check: openclaw gateway status"
  );
}

function selectAccount(
  state: PairingStateFile,
  accountId: string | undefined
): PairingSnapshot | null {
  if (accountId) {
    return state.accounts.find((account) => account.accountId === accountId) ?? null;
  }
  return state.accounts[0] ?? null;
}

/**
 * Read published state.
 *
 * Staleness is reported, not enforced. An earlier version refused to proceed on
 * a stale file; that detection then misfired on a healthy gateway and blocked a
 * legitimate operation. Showing what we have, clearly flagged, is more useful to
 * an operator than refusing — especially since the detection can be wrong.
 */
function readState(): { state: PairingStateFile; stale: boolean } {
  const state = readPairingState();
  if (!state) throw new GatewayNotPublishingError();
  return { state, stale: isStateStale(state) };
}

function parseTimeoutSeconds(raw: string | undefined): number {
  if (!raw) return DEFAULT_REISSUE_TIMEOUT_SECONDS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`--timeout must be a positive number of seconds (got "${raw}")`);
  }
  return seconds;
}

export function formatSnapshot(snapshot: PairingSnapshot | null): string {
  if (!snapshot) {
    return [
      "No KakaoTalk account is running.",
      "",
      "The gateway must be up before a pairing code exists. Check:",
      "  openclaw gateway status",
      "  openclaw channels status --channel kakao-talkchannel",
    ].join("\n");
  }

  const lines: string[] = [`account: ${snapshot.accountId} (${snapshot.talkchannelId})`];

  switch (snapshot.state) {
    case "pending": {
      const remaining = snapshot.expiresInSeconds ?? 0;
      lines.push(
        "",
        `  페어링 코드: ${snapshot.pairingCode}`,
        `  카카오톡에서 입력: /pair ${snapshot.pairingCode}`,
        `  남은 시간: ${Math.floor(remaining / 60)}분 ${remaining % 60}초`
      );
      break;
    }
    case "paired":
      lines.push(`  state: paired${snapshot.pairedUserId ? ` (${snapshot.pairedUserId})` : ""}`);
      lines.push("  A new code is not needed. Use `pairing new` to force one.");
      break;
    case "expired":
      lines.push("  state: expired — the last code is no longer valid.");
      lines.push("  Run: openclaw kakao pairing new");
      break;
    default:
      lines.push("  state: unpaired — no code has been issued yet.");
      lines.push("  Run: openclaw kakao pairing new");
      break;
  }

  if (!snapshot.canReissue && snapshot.reissueBlockedReason) {
    lines.push("", `  note: ${snapshot.reissueBlockedReason}`);
  }

  return lines.join("\n");
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Emit machine-readable output on raw stdout.
 *
 * `ctx.logger.info` prefixes every line with a timestamp and `[plugins]`, which
 * is right for human output and fatal for JSON — `... --json | jq .` would fail
 * to parse. Verified on a live gateway 2026-07-20.
 */
function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Wait for the gateway to publish a code issued after `requestedAt`.
 *
 * Comparing against `issuedAt` is what distinguishes a genuinely new code from
 * the one that was already sitting there.
 */
async function awaitNewCode(
  accountId: string | undefined,
  requestedAt: number,
  timeoutMs: number
): Promise<PairingSnapshot> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const state = readPairingState();
    const snapshot = state ? selectAccount(state, accountId) : null;
    if (
      snapshot &&
      snapshot.state === "pending" &&
      snapshot.issuedAt !== null &&
      snapshot.issuedAt >= requestedAt
    ) {
      return snapshot;
    }
  }

  throw new Error(
    `Timed out after ${Math.round(timeoutMs / 1000)}s waiting for a new pairing code.\n` +
      "  The gateway may not have picked up the request. Check:\n" +
      "    openclaw channels status --channel kakao-talkchannel\n" +
      "    journalctl --user -u openclaw-gateway --since '2 min ago' | grep -i kakao"
  );
}

export function registerPairingCli(api: OpenClawPluginApi): void {
  const registrar = (ctx: OpenClawPluginCliContext): void => {
    const kakao = ctx.program
      .command(CLI_COMMAND_NAME)
      .description("KakaoTalk TalkChannel operations");

    const pairing = kakao.command("pairing").description("Inspect or re-issue the pairing code");

    pairing
      .command("status")
      .description("Show the current pairing code without restarting the gateway")
      .option("--account <id>", "Account id (defaults to the only running account)")
      .option("--json", "Emit raw JSON")
      .action(async (options: CliOptions) => {
        const { state, stale } = readState();
        const snapshot = selectAccount(state, options.account);

        if (options.json) {
          writeJson({ accounts: state.accounts, account: snapshot, stale });
          return;
        }
        if (stale) ctx.logger.warn(staleWarning(state));
        ctx.logger.info(formatSnapshot(snapshot));
      });

    pairing
      .command("new")
      .description("Drop the current session and issue a fresh pairing code")
      .option("--account <id>", "Account id (defaults to the only running account)")
      .option("--json", "Emit raw JSON")
      .option("--timeout <seconds>", "How long to wait for the relay", "30")
      .action(async (options: CliOptions) => {
        // Only a missing file is fatal — there is then nothing to ask. A stale
        // file is reported and the request still goes out: if the gateway is in
        // fact alive it will pick it up, and if it is not, the wait below fails
        // with a message that says so.
        const { state, stale } = readState();
        if (stale && !options.json) ctx.logger.warn(staleWarning(state));

        const timeoutSeconds = parseTimeoutSeconds(options.timeout);
        const request = writePairingRequest(options.account, timeoutSeconds * 1000);

        const snapshot = await awaitNewCode(
          options.account,
          request.requestedAt,
          timeoutSeconds * 1000 + REISSUE_POLL_GRACE_MS
        );

        if (options.json) {
          writeJson({ account: snapshot });
          return;
        }
        ctx.logger.info(formatSnapshot(snapshot));
      });
  };

  // `commands` metadata is mandatory — the host drops CLI registrations that
  // omit it (registry.registerCli: "cli registration missing explicit commands
  // metadata").
  api.registerCli(registrar, {
    commands: [CLI_COMMAND_NAME],
    descriptors: [
      {
        name: CLI_COMMAND_NAME,
        description: "KakaoTalk TalkChannel operations",
        hasSubcommands: true,
      },
    ],
  });
}
