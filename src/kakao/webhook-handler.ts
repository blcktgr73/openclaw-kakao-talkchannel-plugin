/**
 * Kakao Webhook Handler
 *
 * Processes incoming Kakao SkillPayload requests and returns appropriate
 * KakaoSkillResponse. Handles both sync and callback (async) modes.
 */

import type {
  KakaoSkillPayload,
  KakaoSkillResponse,
  ResolvedKakaoTalkChannel,
} from "../types.js";
import { parseSkillPayload, getCallbackUrl } from "./payload.js";
import {
  buildSimpleTextResponse,
  buildCallbackAckResponse,
  buildErrorResponse,
} from "./response.js";
import { sendCallback } from "./callback.js";

export interface WebhookHandlerContext {
  talkchannel: ResolvedKakaoTalkChannel;
  onMessage: (payload: KakaoSkillPayload) => Promise<string>;
  onError?: (error: unknown) => void;
}

const ERROR_MESSAGE_INVALID_REQUEST = "죄송합니다. 요청 형식이 올바르지 않습니다.";
const ERROR_MESSAGE_GENERIC = "죄송합니다. 오류가 발생했습니다.";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("SkillPayload")) {
    return ERROR_MESSAGE_INVALID_REQUEST;
  }
  return ERROR_MESSAGE_GENERIC;
}

export async function handleWebhook(
  body: unknown,
  ctx: WebhookHandlerContext
): Promise<KakaoSkillResponse> {
  try {
    const payload = parseSkillPayload(body);
    const callbackUrl = getCallbackUrl(payload);

    if (callbackUrl) {
      scheduleCallbackProcessing(payload, callbackUrl, ctx);
      return buildCallbackAckResponse();
    }

    const responseText = await ctx.onMessage(payload);
    return buildSimpleTextResponse(responseText);
  } catch (error) {
    ctx.onError?.(error);
    return buildErrorResponse(getErrorMessage(error));
  }
}

function scheduleCallbackProcessing(
  payload: KakaoSkillPayload,
  callbackUrl: string,
  ctx: WebhookHandlerContext
): void {
  setImmediate(async () => {
    try {
      const responseText = await ctx.onMessage(payload);
      const response = buildSimpleTextResponse(responseText);
      const result = await sendCallback(callbackUrl, response);

      if (!result.success) {
        ctx.onError?.(new Error(`Callback failed: ${result.error}`));
      }
    } catch (error) {
      ctx.onError?.(error);

      const errorResponse = buildErrorResponse(ERROR_MESSAGE_GENERIC);
      await sendCallback(callbackUrl, errorResponse).catch((callbackError) => {
        ctx.onError?.(new Error(`Failed to send error callback: ${callbackError}`));
      });
    }
  });
}

export function createWebhookHandler(
  talkchannel: ResolvedKakaoTalkChannel,
  onMessage: (payload: KakaoSkillPayload) => Promise<string>,
  onError?: (error: unknown) => void
): (body: unknown) => Promise<KakaoSkillResponse> {
  return (body: unknown) =>
    handleWebhook(body, {
      talkchannel,
      onMessage,
      onError,
    });
}
