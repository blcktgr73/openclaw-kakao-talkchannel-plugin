/**
 * Kakao Channel Status Adapter
 *
 * Relay mode only status monitoring.
 * Follows ChannelStatusAdapter<ResolvedKakaoTalkChannel> interface from openclaw/plugin-sdk.
 */

import type { ResolvedKakaoTalkChannel, ChannelAccountSnapshot } from "../types.js";
import { getPairingSnapshot } from "../pairing/registry.js";
import { normalizeRelayUrl } from "../relay/session.js";

/**
 * Matches `ChannelStatusIssue` in the real SDK
 * (node_modules/openclaw/dist/types.core-DzCkJQ0r.d.ts:177).
 *
 * The previous shape here was `{ level, message }`, which the host does not
 * understand — issues were being produced in a form nothing rendered.
 */
type StatusIssue = {
  channel: string;
  accountId: string;
  kind: "intent" | "permissions" | "config" | "auth" | "runtime";
  message: string;
  fix?: string;
};

const CHANNEL_ID = "kakao-talkchannel";

/**
 * Pairing fields added to the snapshot. The host spreads plugin snapshots
 * verbatim, so these survive to `openclaw channels status --json`.
 *
 * The pairing **code itself is deliberately excluded** — status output is
 * widely captured (doctor, logs, support bundles) and the code is a
 * short-lived credential. `openclaw kakao pairing status` is the one place
 * that prints it.
 */
interface PairingStatusFields {
  pairingState?: "unpaired" | "pending" | "paired" | "expired";
  pairingExpiresInSeconds?: number | null;
  pairedUserId?: string | null;
}

export const statusAdapter = {
  defaultRuntime: {
    accountId: "default",
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
  } satisfies ChannelAccountSnapshot,

  probeAccount: async ({
    account,
    timeoutMs,
  }: {
    account: ResolvedKakaoTalkChannel;
    timeoutMs: number;
    cfg: unknown;
  }): Promise<{ ok: boolean; latencyMs?: number; error?: string }> => {
    if (!account.config.relayUrl) {
      return { ok: false, error: "relayUrl not configured" };
    }

    const start = Date.now();
    try {
      // Normalized: the raw concat produced `https://host//health` whenever
      // relayUrl ended in a slash, which the default value does.
      const response = await fetch(`${normalizeRelayUrl(account.config.relayUrl)}health`, {
        method: "GET",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      return { ok: true, latencyMs: Date.now() - start };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },

  buildAccountSnapshot: ({
    account,
    runtime,
    probe,
  }: {
    account: ResolvedKakaoTalkChannel;
    cfg: unknown;
    runtime?: ChannelAccountSnapshot;
    probe?: { ok: boolean; latencyMs?: number; error?: string };
  }): ChannelAccountSnapshot => {
    const snapshot: ChannelAccountSnapshot & PairingStatusFields & { probe?: typeof probe } = {
      accountId: account.talkchannelId,
      enabled: account.config.enabled,
      configured: Boolean(account.config.relayUrl),
      running: runtime?.running ?? false,
      connected: runtime?.connected,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      lastInboundAt: runtime?.lastInboundAt ?? null,
      lastOutboundAt: runtime?.lastOutboundAt ?? null,
    };

    // Runs in the gateway process, where the live pairing state exists.
    const pairing = getPairingSnapshot(account.talkchannelId);
    if (pairing) {
      snapshot.pairingState = pairing.state;
      snapshot.pairingExpiresInSeconds = pairing.expiresInSeconds;
      snapshot.pairedUserId = pairing.pairedUserId;
    }

    if (probe !== undefined) {
      snapshot.probe = probe;
    }

    return snapshot;
  },

  collectStatusIssues: (
    accounts: ChannelAccountSnapshot[]
  ): StatusIssue[] => {
    const issues: StatusIssue[] = [];

    for (const account of accounts) {
      const ext = account as ChannelAccountSnapshot &
        PairingStatusFields & {
          probe?: { ok: boolean; error?: string };
        };
      const accountId = ext.accountId ?? "default";

      if (ext.configured && !ext.enabled) {
        issues.push({
          channel: CHANNEL_ID,
          accountId,
          kind: "config",
          message: `Kakao TalkChannel "${accountId}" is configured but disabled`,
          fix: "Set channels.kakao-talkchannel.accounts.<id>.enabled to true",
        });
      }

      if (ext.probe && !ext.probe.ok) {
        issues.push({
          channel: CHANNEL_ID,
          accountId,
          kind: "runtime",
          message: `Kakao relay server unreachable: ${ext.probe.error}`,
        });
      }

      // Pairing prompts. The code is intentionally not included here — see
      // PairingStatusFields.
      if (ext.pairingState === "pending") {
        issues.push({
          channel: CHANNEL_ID,
          accountId,
          kind: "auth",
          message: `Kakao TalkChannel "${accountId}" is waiting to be paired`,
          fix: "Run: openclaw kakao pairing status",
        });
      } else if (ext.pairingState === "expired" || ext.pairingState === "unpaired") {
        issues.push({
          channel: CHANNEL_ID,
          accountId,
          kind: "auth",
          message: `Kakao TalkChannel "${accountId}" is not paired`,
          fix: "Run: openclaw kakao pairing new",
        });
      }

      if (ext.running && ext.lastInboundAt) {
        const silentMs = Date.now() - ext.lastInboundAt;
        if (silentMs > 30 * 60 * 1000) {
          issues.push({
            channel: CHANNEL_ID,
            accountId,
            kind: "runtime",
            message: `Kakao TalkChannel "${accountId}" has not received messages for ${Math.round(silentMs / 60000)} minutes`,
          });
        }
      }
    }

    return issues;
  },
};
