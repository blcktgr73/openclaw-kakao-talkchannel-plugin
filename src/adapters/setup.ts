export interface SetupInput {
  channelId?: string;
  mode?: "direct" | "relay";
  relayUrl?: string;
  relayToken?: string;
  sessionToken?: string;
  publicWebhookUrl?: string;
  name?: string;
}

type ConfigObject = Record<string, unknown>;

function getKakaoConfig(cfg: unknown): {
  config: ConfigObject;
  channels: ConfigObject;
  kakao: ConfigObject;
  talkchannels: ConfigObject;
} {
  const config = (cfg ?? {}) as ConfigObject;
  const channels = (config.channels ?? {}) as ConfigObject;
  const kakao = (channels["kakao-talkchannel"] ?? {}) as ConfigObject;
  const talkchannels = (kakao.talkchannels ?? {}) as ConfigObject;
  return { config, channels, kakao, talkchannels };
}

export const setupAdapter = {
  resolveTalkChannelId: (ctx: { talkchannelId?: string }): string => {
    return ctx.talkchannelId?.trim().toLowerCase() || "default";
  },

  applyTalkChannelName: (ctx: {
    cfg: unknown;
    talkchannelId: string;
    name?: string;
  }): unknown => {
    if (!ctx.name) return ctx.cfg;

    const { config, channels, kakao, talkchannels } = getKakaoConfig(ctx.cfg);
    const existingTalkChannel = (talkchannels[ctx.talkchannelId] ?? {}) as ConfigObject;

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": {
          ...kakao,
          talkchannels: {
            ...talkchannels,
            [ctx.talkchannelId]: { ...existingTalkChannel, name: ctx.name },
          },
        },
      },
    };
  },

  validateInput: (ctx: { talkchannelId: string; input: SetupInput }): string | null => {
    const { input } = ctx;

    // For direct mode, channelId is required
    if (input.mode !== "relay" && !input.channelId) {
      return "channelId is required for direct mode";
    }

    // For relay mode: relayUrl has default, token can be from env or auto-generated
    // No required fields - everything has defaults or auto-creation

    if (input.mode === "direct" && !input.publicWebhookUrl) {
      return "publicWebhookUrl is required for direct mode";
    }

    return null;
  },

  applyTalkChannelConfig: (ctx: {
    cfg: unknown;
    talkchannelId: string;
    input: SetupInput;
  }): unknown => {
    const { talkchannelId, input } = ctx;
    const { config, channels, kakao, talkchannels } = getKakaoConfig(ctx.cfg);

    const talkchannelConfig: ConfigObject = {
      enabled: true,
      mode: input.mode ?? "direct",
      dmPolicy: "pairing",
    };

    // channelId is optional for relay mode
    if (input.channelId) {
      talkchannelConfig.channelId = input.channelId;
    }

    if (input.mode === "relay") {
      // relayUrl and relayToken are optional (have defaults)
      if (input.relayUrl) {
        talkchannelConfig.relayUrl = input.relayUrl;
      }
      if (input.relayToken) {
        talkchannelConfig.relayToken = input.relayToken;
      }
      if (input.sessionToken) {
        talkchannelConfig.sessionToken = input.sessionToken;
      }
    } else {
      talkchannelConfig.publicWebhookUrl = input.publicWebhookUrl;
    }

    if (input.name) {
      talkchannelConfig.name = input.name;
    }

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": {
          ...kakao,
          enabled: true,
          talkchannels: { ...talkchannels, [talkchannelId]: talkchannelConfig },
        },
      },
    };
  },
};
