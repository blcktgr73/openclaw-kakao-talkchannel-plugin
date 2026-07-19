/**
 * Kakao Plugin Entry Point (Simplified)
 *
 * Single channel, relay mode only.
 * No direct mode webhook registration.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { kakaoPlugin, getPendingPairingInfo } from "./src/channel.js";
import { setKakaoRuntime } from "./src/runtime.js";
import { KakaoChannelConfigSchema } from "./src/config/schema.js";
import { registerPairingGatewayMethods } from "./src/pairing/gateway-methods.js";
import { registerPairingCli } from "./src/pairing/cli.js";
import { getPairingSnapshot, listPairingSnapshots } from "./src/pairing/registry.js";

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

    // Pairing state lives in the gateway process; the CLI reaches it over RPC.
    // Both are registered unconditionally — the host loads this plugin in the
    // CLI process too, and each side only exercises what it needs.
    registerPairingGatewayMethods(api);
    registerPairingCli(api);
  },
};

export default plugin;
export { getPendingPairingInfo, getPairingSnapshot, listPairingSnapshots };
