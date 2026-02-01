/**
 * Kakao SkillPayload Parser
 * 
 * Parses and validates Kakao SkillPayload, extracting user and message data.
 * Reference: docs/relay-server-api-spec.md
 */

import type {
  KakaoSkillPayload,
  ParsedKakaoUser,
} from '../types.js';

export const MAX_UTTERANCE_LENGTH = 5000;

function requireField(obj: Record<string, unknown>, field: string, context: string): void {
  if (!obj[field]) {
    throw new Error(`${context} missing required field: ${field}`);
  }
}

/**
 * Parses and validates a Kakao SkillPayload
 * 
 * @param body - Unknown input to parse as KakaoSkillPayload
 * @returns Validated KakaoSkillPayload
 * @throws Error if payload is invalid or missing required fields
 */
export function parseSkillPayload(body: unknown): KakaoSkillPayload {
  if (body === null || body === undefined || typeof body !== 'object') {
    throw new Error('SkillPayload must be an object');
  }

  const payload = body as Record<string, unknown>;

  requireField(payload, 'intent', 'SkillPayload');
  requireField(payload, 'userRequest', 'SkillPayload');
  requireField(payload, 'bot', 'SkillPayload');
  requireField(payload, 'action', 'SkillPayload');

  const userRequest = payload.userRequest as Record<string, unknown>;
  requireField(userRequest, 'utterance', 'userRequest');

  if (typeof userRequest.utterance !== 'string' || userRequest.utterance.trim() === '') {
    throw new Error('userRequest.utterance must be a non-empty string');
  }

  if (userRequest.utterance.length > MAX_UTTERANCE_LENGTH) {
    throw new Error(`userRequest.utterance exceeds maximum length of ${MAX_UTTERANCE_LENGTH} characters`);
  }

  requireField(userRequest, 'user', 'userRequest');

  const user = userRequest.user as Record<string, unknown>;
  requireField(user, 'id', 'userRequest.user');

  return payload as unknown as KakaoSkillPayload;
}

/**
 * Extracts user ID from KakaoSkillPayload
 * 
 * @param payload - Validated KakaoSkillPayload
 * @returns User ID (botUserKey)
 * @throws Error if user.id is missing
 */
export function extractUserId(payload: KakaoSkillPayload): string {
  const userId = payload.userRequest.user.id;

  if (!userId) {
    throw new Error('Cannot extract userId: user.id is missing');
  }

  return userId;
}

/**
 * Extracts utterance (user message) from KakaoSkillPayload
 * 
 * @param payload - Validated KakaoSkillPayload
 * @returns User utterance text
 * @throws Error if utterance is missing or empty
 */
export function extractUtterance(payload: KakaoSkillPayload): string {
  const utterance = payload.userRequest.utterance;

  if (!utterance || utterance.trim() === '') {
    throw new Error('Cannot extract utterance: utterance is missing or empty');
  }

  return utterance;
}

/**
 * Parses Kakao user information from payload
 * 
 * Prefers plusfriendUserKey if available, falls back to botUserKey.
 * 
 * @param payload - Validated KakaoSkillPayload
 * @returns ParsedKakaoUser with user identifiers and friend status
 * @throws Error if user.id is missing
 */
export function parseKakaoUser(payload: KakaoSkillPayload): ParsedKakaoUser {
  const user = payload.userRequest.user;

  if (!user.id) {
    throw new Error('Cannot parse user: user.id is missing');
  }

  const plusfriendUserKey = user.properties?.plusfriendUserKey;
  const isFriend = user.properties?.isFriend ?? false;

  return {
    botUserKey: user.id,
    plusfriendUserKey,
    isFriend,
  };
}

/**
 * Gets callback URL from payload if present
 * 
 * @param payload - Validated KakaoSkillPayload
 * @returns Callback URL or null if not present
 */
export function getCallbackUrl(payload: KakaoSkillPayload): string | null {
  const callbackUrl = payload.userRequest.callbackUrl;
  return callbackUrl && callbackUrl.trim() !== '' ? callbackUrl : null;
}

/**
 * Checks if payload has a callback URL
 * 
 * @param payload - Validated KakaoSkillPayload
 * @returns true if callbackUrl is present and non-empty
 */
export function hasCallbackUrl(payload: KakaoSkillPayload): boolean {
  return getCallbackUrl(payload) !== null;
}
