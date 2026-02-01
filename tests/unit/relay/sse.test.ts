import { describe, it, expect } from "vitest";
import {
  calculateReconnectDelay,
  parseSSEChunk,
} from "../../../src/relay/sse";

describe("SSE Client", () => {
  describe("calculateReconnectDelay", () => {
    it("should calculate exponential backoff with jitter", () => {
      const delay = calculateReconnectDelay(0, 1000, 30000);
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1200);
    });

    it("should increase delay exponentially with each attempt", () => {
      const delay0 = calculateReconnectDelay(0, 1000, 30000);
      const delay1 = calculateReconnectDelay(1, 1000, 30000);
      const delay2 = calculateReconnectDelay(2, 1000, 30000);

      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it("should cap delay at maxDelayMs", () => {
      const delay = calculateReconnectDelay(10, 1000, 5000);
      expect(delay).toBeLessThanOrEqual(5000 + 5000 * 0.2);
    });

    it("should include jitter in calculation", () => {
      const delays = Array.from({ length: 10 }, () =>
        calculateReconnectDelay(1, 1000, 30000)
      );
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe("parseSSEChunk", () => {
    it("should parse single message event", () => {
      const chunk = `event: message
data: {"id":"msg_1","timestamp":1234567890}

`;
      const events = parseSSEChunk(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe("message");
      expect(events[0].data).toEqual({ id: "msg_1", timestamp: 1234567890 });
    });

    it("should parse ping event", () => {
      const chunk = `event: ping
data: {}

`;
      const events = parseSSEChunk(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe("ping");
      expect(events[0].data).toEqual({});
    });

    it("should parse error event", () => {
      const chunk = `event: error
data: {"code":"AUTH_FAILED","message":"Invalid token"}

`;
      const events = parseSSEChunk(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe("error");
      expect(events[0].data).toEqual({ code: "AUTH_FAILED", message: "Invalid token" });
    });

    it("should parse event with id", () => {
      const chunk = `event: message
id: evt_123
data: {"id":"msg_1"}

`;
      const events = parseSSEChunk(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe("evt_123");
    });

    it("should parse multiple events in single chunk", () => {
      const chunk = `event: ping
data: {}

event: message
data: {"id":"msg_1"}

event: message
data: {"id":"msg_2"}

`;
      const events = parseSSEChunk(chunk);

      expect(events).toHaveLength(3);
      expect(events[0].event).toBe("ping");
      expect(events[1].event).toBe("message");
      expect(events[2].event).toBe("message");
    });

    it("should skip malformed JSON", () => {
      const chunk = `event: message
data: {invalid json}

event: message
data: {"id":"msg_1"}

`;
      const events = parseSSEChunk(chunk);

      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual({ id: "msg_1" });
    });

    it("should handle incomplete events", () => {
      const chunk = `event: message
data: {"id":"msg_1"}`;

      const events = parseSSEChunk(chunk);
      expect(events).toHaveLength(0);
    });

    it("should handle empty chunk", () => {
      const events = parseSSEChunk("");
      expect(events).toHaveLength(0);
    });
  });
});
