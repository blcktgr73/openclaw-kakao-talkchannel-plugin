import type { SSEEvent, SSEClientConfig, InboundMessage } from "../types.js";

const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30000;
const DEFAULT_TIMEOUT_MS = 60000;

export interface SSEHandlers {
  onMessage: (msg: InboundMessage) => Promise<void>;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
  onConnected?: () => void;
}

export function calculateReconnectDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  const jitter = cappedDelay * 0.2 * Math.random();
  return Math.floor(cappedDelay + jitter);
}

export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split("\n");

  let currentEvent: Partial<{ event: string; data: string; id: string }> = {};

  for (const line of lines) {
    if (line === "") {
      if (currentEvent.event && currentEvent.data) {
        try {
          const parsedData = JSON.parse(currentEvent.data);
          events.push({
            event: currentEvent.event as SSEEvent["event"],
            data: parsedData,
            id: currentEvent.id,
          } as SSEEvent);
        } catch {
          // Skip malformed JSON
        }
      }
      currentEvent = {};
      continue;
    }

    if (line.startsWith("event:")) {
      currentEvent.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      currentEvent.data = line.slice(5).trim();
    } else if (line.startsWith("id:")) {
      currentEvent.id = line.slice(3).trim();
    }
  }

  return events;
}

function createTimeoutSignal(
  timeoutMs: number,
  parentSignal?: AbortSignal
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (parentSignal) {
    parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

export async function connectSSE(
  config: SSEClientConfig,
  handlers: SSEHandlers,
  abortSignal: AbortSignal
): Promise<void> {
  const reconnectDelayMs = config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
  const maxReconnectDelayMs = config.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let reconnectAttempt = 0;
  let lastEventId: string | undefined;

  while (!abortSignal.aborted) {
    const timeout = createTimeoutSignal(timeoutMs, abortSignal);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${config.relayToken}`,
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      };

      if (lastEventId) {
        headers["Last-Event-ID"] = lastEventId;
      }

      const response = await fetch(`${config.relayUrl}/messages/stream`, {
        method: "GET",
        headers,
        signal: timeout.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: HTTP ${response.status}`);
      }

      if (!response.body) {
        throw new Error("SSE connection failed: no response body");
      }

      reconnectAttempt = 0;
      handlers.onConnected?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!abortSignal.aborted) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSEChunk(buffer);

        const lastNewline = buffer.lastIndexOf("\n\n");
        if (lastNewline !== -1) {
          buffer = buffer.slice(lastNewline + 2);
        }

        for (const event of events) {
          if (event.id) {
            lastEventId = event.id;
          }

          if (event.event === "message") {
            await handlers.onMessage(event.data);
          } else if (event.event === "error") {
            handlers.onError?.(new Error(event.data.message));
          }
        }
      }
    } catch (error) {
      if (abortSignal.aborted) {
        return;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      handlers.onError?.(err);

      reconnectAttempt++;
      const delay = calculateReconnectDelay(reconnectAttempt, reconnectDelayMs, maxReconnectDelayMs);
      handlers.onReconnect?.(reconnectAttempt);

      await sleep(delay, abortSignal);
    } finally {
      timeout.clear();
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Aborted"));
      return;
    }

    const abortHandler = (): void => {
      clearTimeout(timeout);
      reject(new Error("Aborted"));
    };

    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abortHandler);
      resolve();
    }, ms);

    signal.addEventListener("abort", abortHandler, { once: true });
  });
}
