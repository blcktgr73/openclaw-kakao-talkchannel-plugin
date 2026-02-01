/**
 * 테스트 인프라 검증용 기본 테스트
 */
import { describe, it, expect } from "vitest";
import {
  validSkillPayload,
  expectedResponse,
  callbackAckResponse,
} from "./fixtures/payloads";

describe("Test Infrastructure", () => {
  it("should load test fixtures correctly", () => {
    expect(validSkillPayload).toBeDefined();
    expect(validSkillPayload.userRequest.utterance).toBe("안녕하세요");
  });

  it("should have valid response structure", () => {
    expect(expectedResponse.version).toBe("2.0");
    expect(expectedResponse.template.outputs).toHaveLength(1);
  });

  it("should have valid callback ack structure", () => {
    expect(callbackAckResponse.version).toBe("2.0");
    expect(callbackAckResponse.useCallback).toBe(true);
  });

  it("should perform basic assertions", () => {
    expect(1 + 1).toBe(2);
    expect(true).toBeTruthy();
    expect(null).toBeNull();
  });
});
