declare module "openclaw/plugin-sdk" {
  export interface PluginRuntime {
    logger: {
      debug: (...args: unknown[]) => void;
      info: (...args: unknown[]) => void;
      warn: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
    };
    channel: {
      reply: {
        finalizeInboundContext: (ctx: unknown) => unknown;
        dispatchReplyWithBufferedBlockDispatcher: (params: {
          ctx: unknown;
          cfg: unknown;
          dispatcherOptions: {
            deliver: (payload: unknown) => void | Promise<void>;
            onReplyStart?: () => void | Promise<void>;
            onIdle?: () => void | Promise<void>;
            onError?: (err: Error, info: { kind: string }) => void;
          };
        }) => Promise<unknown>;
      };
    };
  }
}
