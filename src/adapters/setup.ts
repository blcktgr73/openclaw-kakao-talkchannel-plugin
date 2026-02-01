/**
 * Kakao Channel Setup Adapter (Simplified)
 *
 * Relay mode only - minimal validation required.
 */

export interface SetupInput {
  channelId?: string;
  relayUrl?: string;
  relayToken?: string;
  sessionToken?: string;
  name?: string;
}

type ConfigObject = Record<string, unknown>;

function getKakaoConfig(cfg: unknown): {
  config: ConfigObject;
  channels: ConfigObject;
  kakao: ConfigObject;
} {
  const config = (cfg ?? {}) as ConfigObject;
  const channels = (config.channels ?? {}) as ConfigObject;
  const kakao = (channels["kakao-talkchannel"] ?? {}) as ConfigObject;
  return { config, channels, kakao };
}

export const setupAdapter = {
  resolveTalkChannelId: (_ctx: { talkchannelId?: string }): string => {
    return "default"; // Always "default" for single channel
  },

  applyTalkChannelName: (ctx: {
    cfg: unknown;
    talkchannelId: string;
    name?: string;
  }): unknown => {
    if (!ctx.name) return ctx.cfg;

    const { config, channels, kakao } = getKakaoConfig(ctx.cfg);

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": {
          ...kakao,
          name: ctx.name,
        },
      },
    };
  },

  validateInput: (_ctx: { talkchannelId: string; input: SetupInput }): string | null => {
    // Relay mode: no required fields
    // - relayUrl has default
    // - relayToken can be from env or auto-generated
    // - channelId is optional (pairing-based identification)
    return null;
  },

  applyTalkChannelConfig: (ctx: {
    cfg: unknown;
    talkchannelId: string;
    input: SetupInput;
  }): unknown => {
    const { input } = ctx;
    const { config, channels, kakao } = getKakaoConfig(ctx.cfg);

    const channelConfig: ConfigObject = {
      ...kakao,
      enabled: true,
      dmPolicy: (kakao.dmPolicy as string) ?? "pairing",
    };

    // Optional channelId
    if (input.channelId) {
      channelConfig.channelId = input.channelId;
    }

    // Optional relay settings
    if (input.relayUrl) {
      channelConfig.relayUrl = input.relayUrl;
    }
    if (input.relayToken) {
      channelConfig.relayToken = input.relayToken;
    }
    if (input.sessionToken) {
      channelConfig.sessionToken = input.sessionToken;
    }

    // Optional name
    if (input.name) {
      channelConfig.name = input.name;
    }

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": channelConfig,
      },
    };
  },
};
