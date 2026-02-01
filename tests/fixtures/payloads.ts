/**
 * Kakao SkillPayload 테스트 데이터
 */

import type { KakaoSkillPayload } from '../../src/types.js';

export const validSkillPayload: KakaoSkillPayload = {
  intent: {
    id: "intent_123",
    name: "기본 응답",
  },
  userRequest: {
    timezone: "Asia/Seoul",
    utterance: "안녕하세요",
    lang: "ko",
    user: {
      id: "botUserKey_abc123",
      type: "botUserKey",
      properties: {
        plusfriendUserKey: "plusfriend_xyz789",
        isFriend: true,
      },
    },
    block: {
      id: "block_456",
      name: "폴백 블록",
    },
  },
  bot: {
    id: "bot_789",
    name: "테스트봇",
  },
  action: {
    id: "action_001",
    name: "기본 스킬",
    params: {},
    detailParams: {},
    clientExtra: {},
  },
};

export const skillPayloadWithCallback: KakaoSkillPayload = {
  ...validSkillPayload,
  userRequest: {
    ...validSkillPayload.userRequest,
    callbackUrl: "https://bot-api.kakao.com/callback/test123",
  },
};

export const skillPayloadMinimal: KakaoSkillPayload = {
  intent: { id: "i1", name: "n1" },
  userRequest: {
    timezone: "Asia/Seoul",
    utterance: "테스트",
    lang: "ko",
    user: {
      id: "user1",
      type: "botUserKey",
      properties: {},
    },
  },
  bot: { id: "b1", name: "bot" },
  action: { id: "a1", name: "action", params: {}, detailParams: {}, clientExtra: {} },
};

export const invalidPayloads = {
  missingIntent: {
    userRequest: validSkillPayload.userRequest,
    bot: validSkillPayload.bot,
    action: validSkillPayload.action,
  },
  missingUtterance: {
    ...validSkillPayload,
    userRequest: {
      ...validSkillPayload.userRequest,
      utterance: undefined,
    },
  },
  emptyUtterance: {
    ...validSkillPayload,
    userRequest: {
      ...validSkillPayload.userRequest,
      utterance: "",
    },
  },
};

export const expectedResponse = {
  version: "2.0" as const,
  template: {
    outputs: [
      {
        simpleText: {
          text: "안녕하세요! 무엇을 도와드릴까요?",
        },
      },
    ],
  },
};

export const callbackAckResponse = {
  version: "2.0" as const,
  useCallback: true,
};
