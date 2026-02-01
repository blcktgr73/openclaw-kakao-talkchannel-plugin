/**
 * Kakao Channel Status Adapter
 *
 * Provides status monitoring and health checks for Kakao TalkChannels.
 * Supports both direct and relay modes with probe capabilities.
 */

import type { ResolvedKakaoTalkChannel } from "../types.js";

export interface ChannelTalkChannelSnapshot {
  talkchannelId: string;
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
  talkchannelId?: string;
}

export interface TalkChannelRuntime {
  talkchannelId: string;
  running: boolean;
  lastStartAt: string | null;
  lastStopAt: string | null;
  lastError: string | null;
  lastInboundAt?: string | null;
  lastOutboundAt?: string | null;
}

export const statusAdapter = {
  defaultRuntime: {
    talkchannelId: "default",
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
  } as TalkChannelRuntime,

  probeTalkChannel: async (ctx: {
    talkchannel: ResolvedKakaoTalkChannel;
    timeoutMs?: number;
  }): Promise<{ ok: boolean; latencyMs?: number; error?: string }> => {
    const { talkchannel, timeoutMs = 5000 } = ctx;

    if (talkchannel.config.mode === "relay") {
      if (!talkchannel.config.relayUrl) {
        return { ok: false, error: "relayUrl not configured" };
      }

      const start = Date.now();
      try {
        const response = await fetch(`${talkchannel.config.relayUrl}/health`, {
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

  buildTalkChannelSnapshot: (ctx: {
    talkchannel: ResolvedKakaoTalkChannel;
    runtime?: TalkChannelRuntime;
    probe?: { ok: boolean; latencyMs?: number; error?: string };
  }): ChannelTalkChannelSnapshot => {
    const { talkchannel, runtime, probe } = ctx;

    return {
      talkchannelId: talkchannel.talkchannelId,
      name: talkchannel.config.channelId,
      enabled: talkchannel.config.enabled,
      configured: Boolean(talkchannel.config.channelId),
      mode: talkchannel.config.mode,
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
    talkchannels: ChannelTalkChannelSnapshot[]
  ): ChannelStatusIssue[] => {
    const issues: ChannelStatusIssue[] = [];

    for (const talkchannel of talkchannels) {
      if (talkchannel.configured && !talkchannel.enabled) {
        issues.push({
          level: "warn",
          message: `Kakao TalkChannel "${talkchannel.talkchannelId}" is configured but disabled`,
          talkchannelId: talkchannel.talkchannelId,
        });
      }

      if (talkchannel.mode === "relay" && talkchannel.probe && !talkchannel.probe.ok) {
        issues.push({
          level: "error",
          message: `Kakao relay server unreachable: ${talkchannel.probe.error}`,
          talkchannelId: talkchannel.talkchannelId,
        });
      }

      if (talkchannel.running && talkchannel.lastInboundAt) {
        const silentMs =
          Date.now() - new Date(talkchannel.lastInboundAt).getTime();
        if (silentMs > 30 * 60 * 1000) {
          issues.push({
            level: "warn",
            message: `Kakao TalkChannel "${talkchannel.talkchannelId}" has not received messages for ${Math.round(silentMs / 60000)} minutes`,
            talkchannelId: talkchannel.talkchannelId,
          });
        }
      }
    }

    return issues;
  },
};
