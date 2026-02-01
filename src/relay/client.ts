import type {
  RelayClientConfig,
  SendReplyResponse,
  KakaoSkillResponse,
} from "../types.js";

const DEFAULT_TIMEOUT_MS = 10000;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function validateSendReplyResponse(data: unknown): SendReplyResponse {
  if (!isObject(data)) {
    throw new Error("Invalid relay response: expected object");
  }
  if (typeof data.success !== "boolean") {
    throw new Error("Invalid relay response: success must be a boolean");
  }
  return data as unknown as SendReplyResponse;
}

function createTimeoutSignal(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function parseErrorBody(body: unknown): string {
  return (body as Record<string, unknown>)?.error as string || "Unknown error";
}

export async function sendReply(
  config: RelayClientConfig,
  messageId: string,
  response: KakaoSkillResponse
): Promise<SendReplyResponse> {
  const timeout = createTimeoutSignal(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const fetchResponse = await fetch(`${config.relayUrl}/reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.relayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messageId, response }),
      signal: timeout.signal,
    });

    if (!fetchResponse.ok) {
      const errorBody = await fetchResponse.json().catch(() => ({}));
      throw new Error(
        `HTTP ${fetchResponse.status} ${fetchResponse.statusText}: ${parseErrorBody(errorBody)}`
      );
    }

    return validateSendReplyResponse(await fetchResponse.json());
  } finally {
    timeout.clear();
  }
}

export async function healthCheck(
  config: RelayClientConfig
): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const timeout = createTimeoutSignal(config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const startTime = Date.now();

  try {
    const response = await fetch(`${config.relayUrl}/health`, {
      method: "GET",
      headers: { Authorization: `Bearer ${config.relayToken}` },
      signal: timeout.signal,
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return { ok: false, latencyMs, error: `HTTP ${response.status} ${response.statusText}` };
    }

    return { ok: true, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, latencyMs, error: errorMessage };
  } finally {
    timeout.clear();
  }
}

export { connectSSE, parseSSEChunk, calculateReconnectDelay } from "./sse.js";
export type { SSEHandlers } from "./sse.js";
export type { RelayClientConfig };
