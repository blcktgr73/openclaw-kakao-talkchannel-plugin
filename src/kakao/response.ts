/**
 * Kakao SkillResponse Builder
 *
 * Builds v2.0 format responses for Kakao Channel Plugin.
 * Handles text chunking for 500-char visible limit (1000 char total).
 *
 * Reference: docs/relay-server-api-spec.md
 */

import type { KakaoSkillResponse, KakaoOutput } from "../types.js";

/**
 * Build v2.0 response with simpleText output
 *
 * @param text - Text content to send
 * @returns KakaoSkillResponse with simpleText template
 */
export function buildSimpleTextResponse(text: string): KakaoSkillResponse {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }],
    },
  };
}

/**
 * Build callback acknowledgment response
 *
 * Used when processing will take longer than 5 seconds.
 * Tells Kakao to wait for callback via callbackUrl.
 *
 * @returns KakaoSkillResponse with useCallback flag
 */
export function buildCallbackAckResponse(): KakaoSkillResponse {
  return {
    version: "2.0",
    useCallback: true,
  };
}

/**
 * Build error response
 *
 * @param message - Error message to display to user
 * @returns KakaoSkillResponse with error message
 */
export function buildErrorResponse(message: string): KakaoSkillResponse {
  return {
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text: message } }],
    },
  };
}

/**
 * Chunk text for Kakao's 500-char visible limit
 *
 * Splits text at sentence boundaries (. ! ?) to maintain readability.
 * Falls back to hard limit if no sentence boundary found.
 *
 * @param text - Text to chunk
 * @param limit - Character limit per chunk (default: 500)
 * @returns Array of text chunks
 */
export function chunkTextForKakao(text: string, limit: number = 500): string[] {
  if (!text || text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // Try to find sentence boundary within limit
    const substring = remaining.substring(0, limit);
    const lastSentenceEnd = Math.max(
      substring.lastIndexOf("."),
      substring.lastIndexOf("!"),
      substring.lastIndexOf("?")
    );

    if (lastSentenceEnd > 0) {
      // Found sentence boundary, include the punctuation
      chunks.push(remaining.substring(0, lastSentenceEnd + 1));
      remaining = remaining.substring(lastSentenceEnd + 1).trim();
    } else {
      // No sentence boundary, hard split at limit
      chunks.push(remaining.substring(0, limit));
      remaining = remaining.substring(limit).trim();
    }
  }

  return chunks;
}

export function buildMultiTextResponse(texts: string[]): KakaoSkillResponse {
  const outputs: KakaoOutput[] = texts.slice(0, 3).map((text) => ({
    simpleText: { text },
  }));

  return {
    version: "2.0",
    template: { outputs },
  };
}
