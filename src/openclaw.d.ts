// Hand-written subset of the OpenClaw plugin SDK surface.
//
// NOTE: this ambient declaration *shadows* the real types shipped in
// openclaw/dist/plugin-sdk. Anything declared here is therefore NOT checked
// against the SDK by the compiler — if the real API changes, only runtime will
// tell us. Mirror signatures from node_modules/openclaw/dist when adding to
// this file, and keep it to the members the plugin actually uses.
declare module "openclaw/plugin-sdk" {
  export interface PluginStateKeyedStore<T> {
    register(key: string, value: T, opts?: { ttlMs?: number }): Promise<void>;
    lookup(key: string): Promise<T | undefined>;
    delete(key: string): Promise<boolean>;
  }

  export interface OpenKeyedStoreOptions {
    namespace: string;
    maxEntries: number;
    overflowPolicy?: "evict-oldest" | "reject-new";
    defaultTtlMs?: number;
  }

  export interface PluginRuntime {
    /** SQLite-backed keyed storage; survives a gateway restart. */
    state: {
      openKeyedStore: <T>(options: OpenKeyedStoreOptions) => PluginStateKeyedStore<T>;
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
