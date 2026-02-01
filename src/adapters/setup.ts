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

function getKakaoTalkchannelConfig(cfg: unknown): {
  config: ConfigObject;
  channels: ConfigObject;
  talkchannelConfig: ConfigObject;
} {
  const config = (cfg ?? {}) as ConfigObject;
  const channels = (config.channels ?? {}) as ConfigObject;
  const talkchannelConfig = (channels["kakao-talkchannel"] ?? {}) as ConfigObject;
  return { config, channels, talkchannelConfig };
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

    const { config, channels, talkchannelConfig } = getKakaoTalkchannelConfig(ctx.cfg);

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": {
          ...talkchannelConfig,
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
    const { config, channels, talkchannelConfig } = getKakaoTalkchannelConfig(ctx.cfg);

    const accountConfig: ConfigObject = {
      ...talkchannelConfig,
      enabled: true,
      dmPolicy: (talkchannelConfig.dmPolicy as string) ?? "pairing",
    };

    // Optional channelId
    if (input.channelId) {
      accountConfig.channelId = input.channelId;
    }

    // Optional relay settings
    if (input.relayUrl) {
      accountConfig.relayUrl = input.relayUrl;
    }
    if (input.relayToken) {
      accountConfig.relayToken = input.relayToken;
    }
    if (input.sessionToken) {
      accountConfig.sessionToken = input.sessionToken;
    }

    // Optional name
    if (input.name) {
      accountConfig.name = input.name;
    }

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": accountConfig,
      },
    };
  },
};
