import type { ResolvedKakaoAccount } from "../types.js";
import { chunkTextForKakao as chunkTextForKakaoImpl } from "../kakao/response.js";

export interface OutboundContext {
  to: string;
  text: string;
  accountId: string;
  account: ResolvedKakaoAccount;
}

export interface OutboundResult {
  channel: "kakao-talkchannel";
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ChannelOutboundAdapter {
  deliveryMode: "direct" | "gateway";
  textChunkLimit: number;
  chunkerMode: "text" | "markdown";
  chunker: (text: string, limit: number) => string[];
  sendText: (ctx: OutboundContext) => Promise<OutboundResult>;
}

export function chunkTextForKakao(text: string, limit: number = 500): string[] {
  return chunkTextForKakaoImpl(text, limit);
}

export const outboundAdapter: ChannelOutboundAdapter = {
  deliveryMode: "direct",
  textChunkLimit: 500,
  chunkerMode: "text",
  chunker: chunkTextForKakao,

  sendText: async (_ctx: OutboundContext): Promise<OutboundResult> => {
    return { channel: "kakao-talkchannel", success: true };
  },
};
