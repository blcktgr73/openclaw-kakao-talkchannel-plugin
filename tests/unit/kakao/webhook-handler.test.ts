/**
 * Kakao Webhook Handler Tests
 *
 * Tests for webhook handler that processes Kakao SkillPayload
 * and returns appropriate KakaoSkillResponse.
 */

import { describe, it, expect, vi } from "vitest";
import {
  handleWebhook,
  createWebhookHandler,
} from "../../../src/kakao/webhook-handler";
import type {
  KakaoSkillPayload,
  KakaoSkillResponse,
  ResolvedKakaoAccount,
} from "../../../src/types";
import {
  validSkillPayload,
  skillPayloadWithCallback,
  skillPayloadMinimal,
  invalidPayloads,
} from "../../fixtures/payloads";

// Mock account for testing
const mockAccount: ResolvedKakaoAccount = {
  accountId: "test-account-123",
  config: {
    enabled: true,
    channelId: "test-channel",
    mode: "direct",
    dmPolicy: "open",
  },
  enabled: true,
  name: "Test Account",
};

describe("handleWebhook", () => {
  it("should parse valid payload and call onMessage handler", async () => {
    const onMessage = vi.fn().mockResolvedValue("응답 메시지");

    const response = await handleWebhook(validSkillPayload, {
      account: mockAccount,
      onMessage,
    });

    expect(onMessage).toHaveBeenCalledWith(validSkillPayload);
    expect(response.version).toBe("2.0");
    expect(response.template?.outputs).toHaveLength(1);
    const output = response.template?.outputs[0];
    expect("simpleText" in output!).toBe(true);
    expect((output as any).simpleText?.text).toBe("응답 메시지");
  });

  it("should return callback ack response when payload has callbackUrl", async () => {
    const onMessage = vi.fn().mockResolvedValue("응답 메시지");

    const response = await handleWebhook(skillPayloadWithCallback, {
      account: mockAccount,
      onMessage,
    });

    expect(response.version).toBe("2.0");
    expect(response.useCallback).toBe(true);
    expect(response.template).toBeUndefined();
  });

  it("should handle invalid payload and return error response", async () => {
    const onMessage = vi.fn();

    const response = await handleWebhook(invalidPayloads.missingIntent, {
      account: mockAccount,
      onMessage,
    });

    expect(onMessage).not.toHaveBeenCalled();
    expect(response.version).toBe("2.0");
    expect(response.template?.outputs).toHaveLength(1);
    const output = response.template?.outputs[0];
    expect("simpleText" in output!).toBe(true);
    expect((output as any).simpleText?.text).toContain("요청 형식");
  });

  it("should handle onMessage handler errors gracefully", async () => {
    const onMessage = vi.fn().mockRejectedValue(new Error("Processing failed"));

    const response = await handleWebhook(validSkillPayload, {
      account: mockAccount,
      onMessage,
    });

    expect(response.version).toBe("2.0");
    expect(response.template?.outputs).toHaveLength(1);
    const output = response.template?.outputs[0];
    expect("simpleText" in output!).toBe(true);
    expect((output as any).simpleText?.text).toContain("오류");
  });

  it("should work with minimal valid payload", async () => {
    const onMessage = vi.fn().mockResolvedValue("테스트 응답");

    const response = await handleWebhook(skillPayloadMinimal, {
      account: mockAccount,
      onMessage,
    });

    expect(onMessage).toHaveBeenCalledWith(skillPayloadMinimal);
    expect(response.version).toBe("2.0");
    const output = response.template?.outputs[0];
    expect("simpleText" in output!).toBe(true);
    expect((output as any).simpleText?.text).toBe("테스트 응답");
  });

  it("should return proper response structure with all required fields", async () => {
    const onMessage = vi.fn().mockResolvedValue("테스트");

    const response = await handleWebhook(validSkillPayload, {
      account: mockAccount,
      onMessage,
    });

    // Verify response structure
    expect(response).toHaveProperty("version");
    expect(response.version).toBe("2.0");
    expect(response.template).toBeDefined();
    expect(response.template?.outputs).toBeDefined();
    expect(Array.isArray(response.template?.outputs)).toBe(true);
    const output = response.template?.outputs[0];
    expect("simpleText" in output!).toBe(true);
  });
});

describe("createWebhookHandler", () => {
  it("should create a handler function that processes webhooks", async () => {
    const onMessage = vi.fn().mockResolvedValue("응답");
    const handler = createWebhookHandler(mockAccount, onMessage);

    const response = await handler(validSkillPayload);

    expect(typeof handler).toBe("function");
    expect(response.version).toBe("2.0");
    expect(onMessage).toHaveBeenCalledWith(validSkillPayload);
  });

  it("should return a function that handles errors", async () => {
    const onMessage = vi.fn().mockRejectedValue(new Error("Failed"));
    const handler = createWebhookHandler(mockAccount, onMessage);

    const response = await handler(validSkillPayload);

    expect(response.version).toBe("2.0");
    const output = response.template?.outputs[0];
    expect("simpleText" in output!).toBe(true);
    expect((output as any).simpleText?.text).toContain("오류");
  });

  it("should return callback ack for payloads with callbackUrl", async () => {
    const onMessage = vi.fn().mockResolvedValue("응답");
    const handler = createWebhookHandler(mockAccount, onMessage);

    const response = await handler(skillPayloadWithCallback);

    expect(response.useCallback).toBe(true);
    expect(response.template).toBeUndefined();
  });

  it("should handle invalid payloads passed to created handler", async () => {
    const onMessage = vi.fn();
    const handler = createWebhookHandler(mockAccount, onMessage);

    const response = await handler(invalidPayloads.emptyUtterance);

    expect(onMessage).not.toHaveBeenCalled();
    expect(response.version).toBe("2.0");
    const output = response.template?.outputs[0];
    expect("simpleText" in output!).toBe(true);
    expect((output as any).simpleText?.text).toContain("오류");
  });
});
