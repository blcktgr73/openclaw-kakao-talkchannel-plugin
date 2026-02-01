/**
 * Kakao Plugin Entry Point (Simplified)
 *
 * Single channel, relay mode only.
 * No direct mode webhook registration.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";
import { kakaoPlugin, getPendingPairingInfo } from "./src/channel.js";
import { setKakaoRuntime } from "./src/runtime.js";
import { KakaoChannelConfigSchema } from "./src/config/schema.js";

interface OpenClawPluginApi {
  runtime: PluginRuntime;
  config: unknown;
  registerChannel: (opts: { plugin: unknown }) => void;
}

const plugin = {
  id: "kakao-talkchannel",
  name: "Kakao TalkChannel",
  description: "Kakao TalkChannel plugin for OpenClaw",
  configSchema: {
    "channels.kakao-talkchannel": {
      schema: KakaoChannelConfigSchema,
      optional: true,  // 설정 없이도 기본값으로 동작
    },
  },

  register(api: OpenClawPluginApi): void {
    setKakaoRuntime(api.runtime);
    api.registerChannel({ plugin: kakaoPlugin });
  },
};

export default plugin;
export { getPendingPairingInfo };
