/**
 * Kakao Channel Status Adapter
 *
 * Provides status monitoring and health checks for Kakao accounts.
 * Supports both direct and relay modes with probe capabilities.
 */

import type { ResolvedKakaoAccount } from "../types.js";

export interface ChannelAccountSnapshot {
  accountId: string;
  name?: string;
  enabled: boolean;
  configured: boolean;
  mode: "direct" | "relay";
  running: boolean;
  lastStartAt: string | null;
  lastStopAt: string | null;
  lastError: string | null;
  probe?: { ok: boolean; latencyMs?: number; error?: string };
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
}

export interface ChannelStatusIssue {
  level: "error" | "warn" | "info";
  message: string;
  accountId?: string;
}

export interface AccountRuntime {
  accountId: string;
  running: boolean;
  lastStartAt: string | null;
  lastStopAt: string | null;
  lastError: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
}

export const statusAdapter = {
  defaultRuntime: {
    accountId: "default",
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
  } as AccountRuntime,

  probeAccount: async (ctx: {
    account: ResolvedKakaoAccount;
    timeoutMs?: number;
  }): Promise<{ ok: boolean; latencyMs?: number; error?: string }> => {
    const { account, timeoutMs = 5000 } = ctx;

    if (account.config.mode === "relay") {
      if (!account.config.relayUrl) {
        return { ok: false, error: "relayUrl not configured" };
      }

      const start = Date.now();
      try {
        const response = await fetch(`${account.config.relayUrl}/health`, {
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
    }

    return { ok: true };
  },

  buildAccountSnapshot: (ctx: {
    account: ResolvedKakaoAccount;
    runtime?: AccountRuntime;
    probe?: { ok: boolean; latencyMs?: number; error?: string };
  }): ChannelAccountSnapshot => {
    const { account, runtime, probe } = ctx;

    return {
      accountId: account.accountId,
      name: account.config.channelId,
      enabled: account.config.enabled,
      configured: Boolean(account.config.channelId),
      mode: account.config.mode,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      probe,
      lastInboundAt: runtime?.lastInboundAt,
      lastOutboundAt: runtime?.lastOutboundAt,
    };
  },

  collectStatusIssues: (
    accounts: ChannelAccountSnapshot[]
  ): ChannelStatusIssue[] => {
    const issues: ChannelStatusIssue[] = [];

    for (const account of accounts) {
      if (account.configured && !account.enabled) {
        issues.push({
          level: "warn",
          message: `Kakao account "${account.accountId}" is configured but disabled`,
          accountId: account.accountId,
        });
      }

      if (account.mode === "relay" && account.probe && !account.probe.ok) {
        issues.push({
          level: "error",
          message: `Kakao relay server unreachable: ${account.probe.error}`,
          accountId: account.accountId,
        });
      }

      if (account.running && account.lastInboundAt) {
        const silentMs =
          Date.now() - new Date(account.lastInboundAt).getTime();
        if (silentMs > 30 * 60 * 1000) {
          issues.push({
            level: "warn",
            message: `Kakao account "${account.accountId}" has not received messages for ${Math.round(silentMs / 60000)} minutes`,
            accountId: account.accountId,
          });
        }
      }
    }

    return issues;
  },
};
