/**
 * Zod schemas for Kakao plugin configuration validation
 *
 * Reference: docs/implementation-plan.md lines 167-212
 */
import { z } from "zod";

const DEFAULT_RELAY_URL = "https://k.tess.dev/";

/**
 * Kakao account configuration schema
 *
 * Note: channelId is optional for relay mode (pairing-based identification)
 */
export const KakaoAccountConfigSchema = z.object({
  // Basic settings
  enabled: z.boolean().default(true),
  channelId: z.string().min(1, "channelId는 필수입니다").optional(),
  mode: z.enum(["direct", "relay"]).default("direct"),

  // Direct mode settings
  publicWebhookUrl: z.string().url("유효한 URL이어야 합니다").optional(),
  webhookPath: z.string().default("/kakao-talkchannel/webhook"),

  // Relay mode settings (SSE)
  relayUrl: z.string().url("유효한 URL이어야 합니다").default(DEFAULT_RELAY_URL),
  relayToken: z.string().optional(),
  sessionToken: z.string().optional(),
  reconnectDelayMs: z.number()
    .min(500, "reconnectDelayMs는 최소 500ms 이상이어야 합니다")
    .max(10000, "reconnectDelayMs는 최대 10000ms 이하여야 합니다")
    .default(1000),
  maxReconnectDelayMs: z.number()
    .min(5000, "maxReconnectDelayMs는 최소 5000ms 이상이어야 합니다")
    .max(60000, "maxReconnectDelayMs는 최대 60000ms 이하여야 합니다")
    .default(30000),

  // Common settings
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).default("pairing"),
  allowFrom: z.array(z.string()).optional(),
  callbackTimeoutMs: z.number()
    .min(5000, "callbackTimeoutMs는 최소 5000ms 이상이어야 합니다")
    .max(55000, "callbackTimeoutMs는 최대 55000ms 이하여야 합니다")
    .default(55000),
}).refine(
  (data) => data.mode === "relay" || data.channelId,
  { message: "channelId는 direct 모드에서 필수입니다", path: ["channelId"] }
);

/**
 * Kakao channel configuration schema (with accounts)
 */
export const KakaoChannelConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(["direct", "relay"]).default("direct"),
  accounts: z.record(z.string(), KakaoAccountConfigSchema).default({}),
});

/**
 * Inferred types from schemas
 */
export type KakaoAccountConfig = z.infer<typeof KakaoAccountConfigSchema>;
export type KakaoChannelConfig = z.infer<typeof KakaoChannelConfigSchema>;

/**
 * Validation result type
 */
export type ValidationResult<T> = 
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

/**
 * Validate account configuration with friendly error messages
 */
export function validateAccountConfig(input: unknown): ValidationResult<KakaoAccountConfig> {
  const result = KakaoAccountConfigSchema.safeParse(input);
  
  if (result.success) {
    return { ok: true, data: result.data };
  }
  
  const errors = result.error.issues.map(issue => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  
  return { ok: false, errors };
}

/**
 * Validate channel configuration
 */
export function validateChannelConfig(input: unknown): ValidationResult<KakaoChannelConfig> {
  const result = KakaoChannelConfigSchema.safeParse(input);
  
  if (result.success) {
    return { ok: true, data: result.data };
  }
  
  const errors = result.error.issues.map(issue => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
  
  return { ok: false, errors };
}
