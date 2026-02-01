/**
 * Kakao Plugin Entry Point
 *
 * Main plugin export for OpenClaw Kakao channel integration.
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";
import { kakaoPlugin } from "./src/channel.js";
import { setKakaoRuntime, getKakaoRuntime } from "./src/runtime.js";
import { resolveKakaoAccount } from "./src/config/accounts.js";
import { createWebhookHandler } from "./src/kakao/webhook-handler.js";
import { buildSimpleTextResponse } from "./src/kakao/response.js";

interface HttpRequest {
  body: unknown;
  method: string;
  url: string;
}

interface HttpResponse {
  statusCode: number;
  end: (body: string) => void;
  setHeader: (name: string, value: string) => void;
}

interface HttpRouteOptions {
  path: string;
  handler: (req: HttpRequest, res: HttpResponse) => Promise<void>;
}

interface OpenClawPluginApi {
  runtime: PluginRuntime;
  config: unknown;
  registerChannel: (opts: { plugin: unknown }) => void;
  registerHttpRoute?: (opts: HttpRouteOptions) => void;
}

const plugin = {
  id: "kakao-talkchannel",
  name: "Kakao TalkChannel",
  description: "Kakao TalkChannel plugin for OpenClaw",
  configSchema: {},
  
  register(api: OpenClawPluginApi): void {
    setKakaoRuntime(api.runtime);
    api.registerChannel({ plugin: kakaoPlugin });

    if (api.registerHttpRoute) {
      api.registerHttpRoute({
        path: "/kakao-talkchannel/webhook",
        handler: async (req, res) => {
          try {
            const account = resolveKakaoAccount(api.config, "default");

            if (account.config.mode !== "direct") {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "Direct mode not enabled" }));
              return;
            }

            const handler = createWebhookHandler(account, async (payload) => {
              return `메시지를 받았습니다: ${payload.userRequest.utterance}`;
            });

            const response = await handler(req.body);
            res.setHeader("Content-Type", "application/json");
            res.statusCode = 200;
            res.end(JSON.stringify(response));
          } catch (error) {
            const runtime = getKakaoRuntime();
            runtime.logger.error(`Webhook error: ${error}`);
            res.statusCode = 500;
            res.end(
              JSON.stringify(
                buildSimpleTextResponse("죄송합니다. 오류가 발생했습니다.")
              )
            );
          }
        },
      });
    }
  },
};

export default plugin;
