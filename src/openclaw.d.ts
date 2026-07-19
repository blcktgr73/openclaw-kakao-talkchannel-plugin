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
    /**
     * RPC into the running gateway process. The CLI runs in a *different*
     * process from the gateway, so this is the only way a CLI command can read
     * live in-memory plugin state.
     *
     * Mirrors `PluginRuntime.gateway` in
     * node_modules/openclaw/dist/types-DaHgOqFX.d.ts.
     */
    gateway: {
      isAvailable: () => boolean | Promise<boolean>;
      request: <T = unknown>(
        method: string,
        params?: unknown,
        options?: { timeoutMs?: number }
      ) => Promise<T>;
    };
  }

  /** Operator scopes accepted by `registerGatewayMethod`. */
  export type OperatorScope = "operator.read" | "operator.write" | "operator.admin";

  export interface GatewayRequestContext {
    params?: unknown;
  }

  export type GatewayRequestHandler = (
    ctx: GatewayRequestContext
  ) => unknown | Promise<unknown>;

  /**
   * Minimal shape of the commander `Command` object handed to a CLI registrar.
   * The real type comes from commander; only what the plugin uses is declared.
   */
  export interface CliCommand {
    command: (nameAndArgs: string) => CliCommand;
    description: (text: string) => CliCommand;
    option: (flags: string, description?: string, defaultValue?: unknown) => CliCommand;
    argument: (name: string, description?: string) => CliCommand;
    action: (handler: (...args: never[]) => unknown | Promise<unknown>) => CliCommand;
  }

  export interface OpenClawPluginCliContext {
    program: CliCommand;
    parentPath: readonly string[];
    config: unknown;
    workspaceDir?: string;
    logger: PluginRuntime["logger"];
  }

  export type OpenClawPluginCliRegistrar = (
    ctx: OpenClawPluginCliContext
  ) => void | Promise<void>;

  export interface OpenClawPluginCliCommandDescriptor {
    name: string;
    description: string;
    hasSubcommands: boolean;
  }

  /**
   * The subset of `OpenClawPluginApi` this plugin uses.
   *
   * The real type has ~50 registration methods; see
   * node_modules/openclaw/dist/types-DaHgOqFX.d.ts:12067. Registering a CLI
   * command *requires* explicit `commands` or `descriptors` metadata —
   * registration is dropped with a diagnostic otherwise.
   */
  export interface OpenClawPluginApi {
    runtime: PluginRuntime;
    config: unknown;
    logger: PluginRuntime["logger"];
    registerChannel: (opts: { plugin: unknown }) => void;
    registerGatewayMethod: (
      method: string,
      handler: GatewayRequestHandler,
      opts?: { scope?: OperatorScope }
    ) => void;
    registerCli: (
      registrar: OpenClawPluginCliRegistrar,
      opts?: {
        parentPath?: string[];
        commands?: string[];
        descriptors?: OpenClawPluginCliCommandDescriptor[];
      }
    ) => void;
  }
}
