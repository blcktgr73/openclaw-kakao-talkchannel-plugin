// Hand-written subset of the OpenClaw plugin SDK surface.
//
// NOTE: this ambient declaration *shadows* the real types shipped in
// openclaw/dist/plugin-sdk. Anything declared here is therefore NOT checked
// against the SDK by the compiler — if the real API changes, only runtime will
// tell us. Mirror signatures from node_modules/openclaw/dist when adding to
// this file, and keep it to the members the plugin actually uses.
declare module "openclaw/plugin-sdk" {
  export type ConfigAfterWrite =
    | { mode: "auto" }
    | { mode: "restart"; reason: string }
    | { mode: "none"; reason: string };

  export interface MutateConfigFileParams {
    afterWrite: ConfigAfterWrite;
    mutate: (draft: Record<string, unknown>) => void | Promise<void>;
  }

  export interface PluginRuntime {
    /**
     * Config read/write. Unlike `state.openKeyedStore`, this is not restricted
     * to bundled/officially-installed plugins.
     */
    config: {
      mutateConfigFile: (params: MutateConfigFileParams) => Promise<unknown>;
    };
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
