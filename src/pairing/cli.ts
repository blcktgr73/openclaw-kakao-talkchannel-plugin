/**
 * `openclaw kakao pairing …` CLI commands.
 *
 * This is the operator-facing answer to "how do I get the pairing code over
 * SSH?". Before this existed the only way was to restart the gateway and grep
 * journald inside a five-minute window — which meant restarting the very thing
 * that had to stay up, and stepping around a double-restart that issued two
 * codes ~45s apart.
 *
 * The CLI runs in a different process from the gateway, so every command here
 * is a thin front end over the `kakao.pairing.*` gateway RPC methods.
 */

import type {
  OpenClawPluginApi,
  OpenClawPluginCliContext,
  PluginRuntime,
} from "openclaw/plugin-sdk";
import {
  DEFAULT_REISSUE_TIMEOUT_MS,
  PAIRING_NEW_METHOD,
  PAIRING_STATUS_METHOD,
  type PairingNewResult,
  type PairingStatusResult,
} from "./gateway-methods.js";
import type { PairingSnapshot } from "./registry.js";

export const CLI_COMMAND_NAME = "kakao";

/** Gateway RPC needs a little headroom over the re-issue wait itself. */
const RPC_TIMEOUT_MARGIN_MS = 15_000;

interface CliOptions {
  account?: string;
  json?: boolean;
  timeout?: string;
}

export class GatewayUnavailableError extends Error {
  constructor() {
    super(
      "The OpenClaw gateway is not reachable. KakaoTalk pairing is only available " +
        "while the gateway is running — start it with `openclaw gateway start`, " +
        "then retry."
    );
    this.name = "GatewayUnavailableError";
  }
}

async function ensureGateway(runtime: PluginRuntime): Promise<void> {
  if (!(await runtime.gateway.isAvailable())) throw new GatewayUnavailableError();
}

function parseTimeoutMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_REISSUE_TIMEOUT_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`--timeout must be a positive number of seconds (got "${raw}")`);
  }
  return Math.round(seconds * 1000);
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
      const minutes = Math.floor((snapshot.expiresInSeconds ?? 0) / 60);
      const seconds = (snapshot.expiresInSeconds ?? 0) % 60;
      lines.push(
        "",
        `  페어링 코드: ${snapshot.pairingCode}`,
        `  카카오톡에서 입력: /pair ${snapshot.pairingCode}`,
        `  남은 시간: ${minutes}분 ${seconds}초`
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

export function registerPairingCli(api: OpenClawPluginApi): void {
  const runtime = api.runtime;

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
        await ensureGateway(runtime);
        const result = await runtime.gateway.request<PairingStatusResult>(
          PAIRING_STATUS_METHOD,
          { accountId: options.account }
        );

        if (options.json) {
          ctx.logger.info(JSON.stringify(result, null, 2));
          return;
        }
        ctx.logger.info(formatSnapshot(result.account));
      });

    pairing
      .command("new")
      .description("Drop the current session and issue a fresh pairing code")
      .option("--account <id>", "Account id (defaults to the only running account)")
      .option("--json", "Emit raw JSON")
      .option("--timeout <seconds>", "How long to wait for the relay", "30")
      .action(async (options: CliOptions) => {
        await ensureGateway(runtime);
        const timeoutMs = parseTimeoutMs(options.timeout);

        const result = await runtime.gateway.request<PairingNewResult>(
          PAIRING_NEW_METHOD,
          { accountId: options.account, timeoutMs },
          { timeoutMs: timeoutMs + RPC_TIMEOUT_MARGIN_MS }
        );

        if (options.json) {
          ctx.logger.info(JSON.stringify(result, null, 2));
          return;
        }
        ctx.logger.info(formatSnapshot(result.account));
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
