/**
 * Kakao SkillPayload Parser Tests
 * 
 * Tests for parsing and extracting data from Kakao SkillPayload
 */

import { describe, it, expect } from 'vitest';
import {
  parseSkillPayload,
  extractUserId,
  extractUtterance,
  parseKakaoUser,
  hasCallbackUrl,
  getCallbackUrl,
} from '../../../src/kakao/payload';
import {
  validSkillPayload,
  skillPayloadWithCallback,
  skillPayloadMinimal,
  invalidPayloads,
} from '../../fixtures/payloads';

describe('parseSkillPayload', () => {
  it('parses valid SkillPayload with all fields', () => {
    const result = parseSkillPayload(validSkillPayload);

    expect(result).toBeDefined();
    expect(result.intent.id).toBe('intent_123');
    expect(result.intent.name).toBe('기본 응답');
    expect(result.userRequest.utterance).toBe('안녕하세요');
    expect(result.bot.id).toBe('bot_789');
    expect(result.action.id).toBe('action_001');
  });

  it('parses minimal valid SkillPayload', () => {
    const result = parseSkillPayload(skillPayloadMinimal);

    expect(result).toBeDefined();
    expect(result.intent.id).toBe('i1');
    expect(result.userRequest.utterance).toBe('테스트');
  });

  it('throws error when intent is missing', () => {
    expect(() => parseSkillPayload(invalidPayloads.missingIntent)).toThrow(
      /intent/i
    );
  });

  it('throws error when utterance is missing', () => {
    expect(() => parseSkillPayload(invalidPayloads.missingUtterance)).toThrow(
      /utterance/i
    );
  });

  it('throws error when utterance is empty string', () => {
    expect(() => parseSkillPayload(invalidPayloads.emptyUtterance)).toThrow(
      /utterance/i
    );
  });

  it('throws error when payload is null', () => {
    expect(() => parseSkillPayload(null)).toThrow();
  });

  it('throws error when payload is undefined', () => {
    expect(() => parseSkillPayload(undefined)).toThrow();
  });

  it('throws error when payload is not an object', () => {
    expect(() => parseSkillPayload('invalid')).toThrow();
    expect(() => parseSkillPayload(123)).toThrow();
    expect(() => parseSkillPayload([])).toThrow();
  });
});

describe('extractUserId', () => {
  it('extracts botUserKey from user.id', () => {
    const userId = extractUserId(validSkillPayload);

    expect(userId).toBe('botUserKey_abc123');
  });

  it('extracts userId from minimal payload', () => {
    const userId = extractUserId(skillPayloadMinimal);

    expect(userId).toBe('user1');
  });

  it('throws error when user.id is missing', () => {
    const invalidPayload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        user: {
          ...validSkillPayload.userRequest.user,
          id: undefined,
        },
      },
    };

    expect(() => extractUserId(invalidPayload as any)).toThrow();
  });
});

describe('extractUtterance', () => {
  it('extracts utterance from userRequest', () => {
    const utterance = extractUtterance(validSkillPayload);

    expect(utterance).toBe('안녕하세요');
  });

  it('extracts utterance from minimal payload', () => {
    const utterance = extractUtterance(skillPayloadMinimal);

    expect(utterance).toBe('테스트');
  });

  it('throws error when utterance is empty', () => {
    const invalidPayload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        utterance: '',
      },
    };

    expect(() => extractUtterance(invalidPayload)).toThrow();
  });

  it('throws error when utterance is missing', () => {
    const invalidPayload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        utterance: undefined,
      },
    };

    expect(() => extractUtterance(invalidPayload as any)).toThrow();
  });
});

describe('parseKakaoUser', () => {
  it('parses user with plusfriendUserKey preference', () => {
    const user = parseKakaoUser(validSkillPayload);

    expect(user.botUserKey).toBe('botUserKey_abc123');
    expect(user.plusfriendUserKey).toBe('plusfriend_xyz789');
    expect(user.isFriend).toBe(true);
  });

  it('parses user without plusfriendUserKey', () => {
    const user = parseKakaoUser(skillPayloadMinimal);

    expect(user.botUserKey).toBe('user1');
    expect(user.plusfriendUserKey).toBeUndefined();
    expect(user.isFriend).toBe(false);
  });

  it('handles missing isFriend property', () => {
    const payload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        user: {
          ...validSkillPayload.userRequest.user,
          properties: {
            plusfriendUserKey: 'test',
          },
        },
      },
    };

    const user = parseKakaoUser(payload);

    expect(user.isFriend).toBe(false);
  });

  it('throws error when user.id is missing', () => {
    const invalidPayload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        user: {
          ...validSkillPayload.userRequest.user,
          id: undefined,
        },
      },
    };

    expect(() => parseKakaoUser(invalidPayload as any)).toThrow();
  });
});

describe('hasCallbackUrl', () => {
  it('returns true when callbackUrl is present', () => {
    const result = hasCallbackUrl(skillPayloadWithCallback);

    expect(result).toBe(true);
  });

  it('returns false when callbackUrl is missing', () => {
    const result = hasCallbackUrl(validSkillPayload);

    expect(result).toBe(false);
  });

  it('returns false when callbackUrl is empty string', () => {
    const payload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        callbackUrl: '',
      },
    };

    const result = hasCallbackUrl(payload);

    expect(result).toBe(false);
  });

  it('returns false when callbackUrl is undefined', () => {
    const payload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        callbackUrl: undefined,
      },
    };

    const result = hasCallbackUrl(payload);

    expect(result).toBe(false);
  });
});

describe('getCallbackUrl', () => {
  it('returns callbackUrl when present', () => {
    const url = getCallbackUrl(skillPayloadWithCallback);

    expect(url).toBe('https://bot-api.kakao.com/callback/test123');
  });

  it('returns null when callbackUrl is missing', () => {
    const url = getCallbackUrl(validSkillPayload);

    expect(url).toBeNull();
  });

  it('returns null when callbackUrl is empty string', () => {
    const payload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        callbackUrl: '',
      },
    };

    const url = getCallbackUrl(payload);

    expect(url).toBeNull();
  });

  it('returns null when callbackUrl is undefined', () => {
    const payload = {
      ...validSkillPayload,
      userRequest: {
        ...validSkillPayload.userRequest,
        callbackUrl: undefined,
      },
    };

    const url = getCallbackUrl(payload);

    expect(url).toBeNull();
  });
});
