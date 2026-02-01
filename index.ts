/**
 * Kakao Plugin Entry Point (Simplified)
 *
 * Single channel, relay mode only.
 * No direct mode webhook registration.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";
import { kakaoPlugin } from "./src/channel.js";
import { setKakaoRuntime } from "./src/runtime.js";

interface OpenClawPluginApi {
  runtime: PluginRuntime;
  config: unknown;
  registerChannel: (opts: { plugin: unknown }) => void;
}

const plugin = {
  id: "kakao-talkchannel",
  name: "Kakao TalkChannel",
  description: "Kakao TalkChannel plugin for OpenClaw",
  configSchema: {},

  register(api: OpenClawPluginApi): void {
    setKakaoRuntime(api.runtime);
    api.registerChannel({ plugin: kakaoPlugin });
  },
};

export default plugin;
