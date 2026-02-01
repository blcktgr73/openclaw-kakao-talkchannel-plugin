/**
 * Kakao Channel Plugin Type Definitions
 * 
 * Reference: 
 * - Kakao SkillPayload/Response: docs/relay-server-api-spec.md
 * - Implementation plan: docs/implementation-plan.md
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
// Plugin Configuration Types
// ============================================================================

export type KakaoDmPolicy = "pairing" | "allowlist" | "open" | "disabled";
export type KakaoConnectionMode = "direct" | "relay";

export interface KakaoTalkChannelConfig {
  enabled: boolean;
  channelId?: string; // Optional for relay mode
  mode: KakaoConnectionMode;

  // Direct mode settings
  publicWebhookUrl?: string;
  webhookPath?: string;

  // Relay mode settings (SSE)
  relayUrl?: string;
  relayToken?: string;
  sessionToken?: string; // Auto-generated session token
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;

  // Common settings
  dmPolicy: KakaoDmPolicy;
  allowFrom?: string[];
  callbackTimeoutMs?: number;
}

export interface ResolvedKakaoTalkChannel {
  talkchannelId: string;
  config: KakaoTalkChannelConfig;
  enabled: boolean;
  name?: string;
  channelId?: string; // Optional for relay mode
  mode: KakaoConnectionMode;
  tokenSource?: "config" | "env" | "session" | "none";
}

// ============================================================================
// Relay Server Types
// ============================================================================

export interface InboundMessage {
  id: string;
  timestamp: number;
  kakaoPayload: KakaoSkillPayload;
  normalized: {
    userId: string;
    text: string;
    channelId: string;
  };
  callbackUrl: string;
  callbackExpiresAt: number;
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
