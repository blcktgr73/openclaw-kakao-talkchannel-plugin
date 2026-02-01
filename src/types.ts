/**
 * Kakao Channel Plugin Type Definitions
 *
 * Simplified: Single channel + Relay mode only
 *
 * Reference:
 * - Kakao SkillPayload/Response: docs/relay-server-api-spec.md
 */

// ============================================================================
// Kakao SkillPayload Types
// ============================================================================

export interface KakaoIntent {
  id: string;
  name: string;
  extra?: {
    knowledges?: KakaoKnowledge[];
  };
}

export interface KakaoKnowledge {
  answer: string;
  question: string;
  categories?: string[];
  landingUrl?: string;
  imageUrl?: string;
}

export interface KakaoUser {
  id: string;
  type: "botUserKey";
  properties: {
    plusfriendUserKey?: string;
    appUserId?: string;
    isFriend?: boolean;
  };
}

export interface KakaoBlock {
  id: string;
  name: string;
}

export interface KakaoUserRequest {
  timezone: string;
  utterance: string;
  lang: string;
  user: KakaoUser;
  block?: KakaoBlock;
  callbackUrl?: string;
}

export interface KakaoBot {
  id: string;
  name: string;
}

export interface KakaoDetailParam {
  origin: string;
  value: string;
  groupName?: string;
}

export interface KakaoAction {
  id: string;
  name: string;
  params: Record<string, string>;
  detailParams: Record<string, KakaoDetailParam>;
  clientExtra: Record<string, unknown>;
}

export interface KakaoSkillPayload {
  intent: KakaoIntent;
  userRequest: KakaoUserRequest;
  bot: KakaoBot;
  action: KakaoAction;
}

// ============================================================================
// Kakao SkillResponse Types (v2.0)
// ============================================================================

export interface KakaoSimpleText {
  simpleText: {
    text: string;
  };
}

export interface KakaoSimpleImage {
  simpleImage: {
    imageUrl: string;
    altText?: string;
  };
}

// MVP: simpleText only, extend later
export type KakaoOutput = KakaoSimpleText | KakaoSimpleImage;

export interface KakaoQuickReply {
  label: string;
  action: "message" | "block";
  messageText?: string;
  blockId?: string;
  extra?: Record<string, unknown>;
}

export interface KakaoContextValue {
  name: string;
  lifeSpan: number;
  params?: Record<string, string>;
}

export interface KakaoContextControl {
  values: KakaoContextValue[];
}

export interface KakaoSkillTemplate {
  outputs: KakaoOutput[];
  quickReplies?: KakaoQuickReply[];
}

export interface KakaoSkillResponse {
  version: "2.0";
  useCallback?: boolean;
  template?: KakaoSkillTemplate;
  context?: KakaoContextControl;
  data?: Record<string, unknown>;
}

// ============================================================================
// Plugin Configuration Types (Simplified: Relay mode only)
// ============================================================================

export type KakaoDmPolicy = "pairing" | "allowlist" | "open" | "disabled";

export interface KakaoChannelConfig {
  // 사용자 설정
  enabled: boolean;
  dmPolicy: KakaoDmPolicy;
  allowFrom?: string[];

  // 고급 설정 (대부분 불필요)
  /** @advanced */
  channelId?: string;
  /** @advanced */
  relayUrl?: string;
  /** @advanced */
  relayToken?: string;

  // 내부 설정 (자동 관리)
  /** @internal */
  sessionToken?: string;
  /** @internal */
  reconnectDelayMs?: number;
  /** @internal */
  maxReconnectDelayMs?: number;
}

export interface ResolvedKakaoTalkChannel {
  talkchannelId: string; // Always "default" for single channel (kept for future extensibility)
  config: KakaoChannelConfig;
  enabled: boolean;
  name?: string;
  channelId?: string; // Optional (from config)
  tokenSource?: "config" | "env" | "session" | "none";
}

// ============================================================================
// Relay Server Types
// ============================================================================

export interface InboundMessage {
  id: string;
  conversationKey: string;
  kakaoPayload?: KakaoSkillPayload; // Optional: raw Kakao payload
  normalized: {
    userId: string;
    text: string;
    channelId: string;
  };
  createdAt: string; // ISO 8601
}

export type SSEEventType = "message" | "ping" | "error" | "pairing_complete" | "pairing_expired";

export interface SSEMessageEvent {
  event: "message";
  data: InboundMessage;
  id?: string;
}

export interface SSEPingEvent {
  event: "ping";
  data: Record<string, never>;
  id?: string;
}

export interface SSEErrorEvent {
  event: "error";
  data: {
    code: string;
    message: string;
  };
  id?: string;
}

export interface SSEPairingCompleteEvent {
  event: "pairing_complete";
  data: {
    kakaoUserId: string;
    pairedAt: string;
  };
  id?: string;
}

export interface SSEPairingExpiredEvent {
  event: "pairing_expired";
  data: {
    reason: string;
  };
  id?: string;
}

export type SSEEvent =
  | SSEMessageEvent
  | SSEPingEvent
  | SSEErrorEvent
  | SSEPairingCompleteEvent
  | SSEPairingExpiredEvent;

export interface SSEClientConfig {
  relayUrl: string;
  relayToken?: string; // Legacy token (environment variable or config)
  sessionToken?: string; // Auto-generated session token
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  timeoutMs?: number;
}

export interface SendReplyRequest {
  messageId: string;
  response: KakaoSkillResponse;
}

export interface SendReplyResponse {
  success: boolean;
  deliveredAt?: number;
  error?: string;
}

export interface RelayClientConfig {
  relayUrl: string;
  relayToken: string;
  timeoutMs?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export type KakaoUserId = string;

export interface ParsedKakaoUser {
  botUserKey: string;
  plusfriendUserKey?: string;
  isFriend: boolean;
}
