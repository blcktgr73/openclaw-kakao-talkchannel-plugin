export interface SetupInput {
  channelId?: string;
  mode?: "direct" | "relay";
  relayUrl?: string;
  relayToken?: string;
  publicWebhookUrl?: string;
  name?: string;
}

type ConfigObject = Record<string, unknown>;

function getKakaoConfig(cfg: unknown): {
  config: ConfigObject;
  channels: ConfigObject;
  kakao: ConfigObject;
  accounts: ConfigObject;
} {
  const config = (cfg ?? {}) as ConfigObject;
  const channels = (config.channels ?? {}) as ConfigObject;
  const kakao = (channels["kakao-talkchannel"] ?? {}) as ConfigObject;
  const accounts = (kakao.accounts ?? {}) as ConfigObject;
  return { config, channels, kakao, accounts };
}

export const setupAdapter = {
  resolveAccountId: (ctx: { accountId?: string }): string => {
    return ctx.accountId?.trim().toLowerCase() || "default";
  },

  applyAccountName: (ctx: {
    cfg: unknown;
    accountId: string;
    name?: string;
  }): unknown => {
    if (!ctx.name) return ctx.cfg;

    const { config, channels, kakao, accounts } = getKakaoConfig(ctx.cfg);
    const existingAccount = (accounts[ctx.accountId] ?? {}) as ConfigObject;

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": {
          ...kakao,
          accounts: {
            ...accounts,
            [ctx.accountId]: { ...existingAccount, name: ctx.name },
          },
        },
      },
    };
  },

  validateInput: (ctx: { accountId: string; input: SetupInput }): string | null => {
    const { input } = ctx;

    if (!input.channelId) {
      return "channelId is required";
    }

    if (input.mode === "relay") {
      if (!input.relayUrl) {
        return "relayUrl is required for relay mode";
      }
      if (!input.relayToken) {
        return "relayToken is required for relay mode";
      }
    }

    if (input.mode === "direct" && !input.publicWebhookUrl) {
      return "publicWebhookUrl is required for direct mode";
    }

    return null;
  },

  applyAccountConfig: (ctx: {
    cfg: unknown;
    accountId: string;
    input: SetupInput;
  }): unknown => {
    const { accountId, input } = ctx;
    const { config, channels, kakao, accounts } = getKakaoConfig(ctx.cfg);

    const accountConfig: ConfigObject = {
      enabled: true,
      channelId: input.channelId,
      mode: input.mode ?? "direct",
      dmPolicy: "pairing",
    };

    if (input.mode === "relay") {
      accountConfig.relayUrl = input.relayUrl;
      accountConfig.relayToken = input.relayToken;
    } else {
      accountConfig.publicWebhookUrl = input.publicWebhookUrl;
    }

    if (input.name) {
      accountConfig.name = input.name;
    }

    return {
      ...config,
      channels: {
        ...channels,
        "kakao-talkchannel": {
          ...kakao,
          enabled: true,
          accounts: { ...accounts, [accountId]: accountConfig },
        },
      },
    };
  },
};
