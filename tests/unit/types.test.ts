/**
 * Type definition tests - verify type exports and structure
 */
import { describe, it, expect } from "vitest";
import type {
  KakaoSkillPayload,
  KakaoSkillResponse,
  KakaoAccountConfig,
  ResolvedKakaoAccount,
  KakaoSimpleText,
  KakaoOutput,
  InboundMessage,
} from "../../src/types";

describe("Kakao Types", () => {
  describe("KakaoSkillPayload", () => {
    it("should accept valid payload structure", () => {
      const payload: KakaoSkillPayload = {
        intent: { id: "i1", name: "test" },
        userRequest: {
          timezone: "Asia/Seoul",
          utterance: "안녕",
          lang: "ko",
          user: {
            id: "user123",
            type: "botUserKey",
            properties: {},
          },
        },
        bot: { id: "b1", name: "bot" },
        action: {
          id: "a1",
          name: "action",
          params: {},
          detailParams: {},
          clientExtra: {},
        },
      };
      expect(payload.userRequest.utterance).toBe("안녕");
    });

    it("should support optional callbackUrl", () => {
      const payload: KakaoSkillPayload = {
        intent: { id: "i1", name: "test" },
        userRequest: {
          timezone: "Asia/Seoul",
          utterance: "test",
          lang: "ko",
          user: { id: "u1", type: "botUserKey", properties: {} },
          callbackUrl: "https://bot-api.kakao.com/callback/xxx",
        },
        bot: { id: "b1", name: "bot" },
        action: { id: "a1", name: "action", params: {}, detailParams: {}, clientExtra: {} },
      };
      expect(payload.userRequest.callbackUrl).toBeDefined();
    });
  });

  describe("KakaoSkillResponse", () => {
    it("should require version 2.0", () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
      };
      expect(response.version).toBe("2.0");
    });

    it("should support useCallback flag", () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        useCallback: true,
      };
      expect(response.useCallback).toBe(true);
    });

    it("should support template with outputs", () => {
      const response: KakaoSkillResponse = {
        version: "2.0",
        template: {
          outputs: [{ simpleText: { text: "Hello" } }],
        },
      };
      expect(response.template?.outputs).toHaveLength(1);
    });
  });

  describe("KakaoAccountConfig", () => {
    it("should have required fields", () => {
      const config: KakaoAccountConfig = {
        enabled: true,
        channelId: "channel123",
        mode: "direct",
        dmPolicy: "pairing",
      };
      expect(config.mode).toBe("direct");
    });

    it("should support relay mode fields", () => {
      const config: KakaoAccountConfig = {
        enabled: true,
        channelId: "channel123",
        mode: "relay",
        dmPolicy: "pairing",
        relayUrl: "https://relay.example.com",
        relayToken: "token123",
        reconnectDelayMs: 1000,
        maxReconnectDelayMs: 30000,
      };
      expect(config.relayUrl).toBeDefined();
    });
  });

  describe("ResolvedKakaoAccount", () => {
    it("should contain accountId and config", () => {
      const resolved: ResolvedKakaoAccount = {
        accountId: "default",
        config: {
          enabled: true,
          channelId: "ch1",
          mode: "direct",
          dmPolicy: "pairing",
        },
        enabled: true,
        name: "Test Account",
      };
      expect(resolved.accountId).toBe("default");
    });
  });

  describe("InboundMessage", () => {
    it("should match relay server spec", () => {
      const msg: InboundMessage = {
        id: "msg_123",
        timestamp: Date.now(),
        kakaoPayload: {} as KakaoSkillPayload,
        normalized: {
          userId: "user1",
          text: "Hello",
          channelId: "ch1",
        },
        callbackUrl: "https://bot-api.kakao.com/callback/xxx",
        callbackExpiresAt: Date.now() + 60000,
      };
      expect(msg.normalized.userId).toBe("user1");
    });
  });
});
