/**
 * Zod schemas for Kakao plugin configuration validation
 *
 * Simplified: Single channel + Relay mode only
 * Direct mode and multi-channel support are planned for future releases.
 */
import { z } from "zod";

const DEFAULT_RELAY_URL = "https://k.tess.dev/";

/**
 * Kakao channel configuration schema (simplified)
 *
 * Single channel, relay mode only.
 * channelId is optional (pairing-based identification)
 */
export const KakaoChannelConfigSchema = z.object({
  // Basic settings
  enabled: z.boolean().default(true),
  channelId: z.string().min(1, "channelId는 필수입니다").optional(),

  // Relay mode settings (SSE)
  relayUrl: z.string().default(DEFAULT_RELAY_URL),
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
});

/**
 * Inferred types from schemas
 */
export type KakaoChannelConfig = z.infer<typeof KakaoChannelConfigSchema>;

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] };

/**
 * Validate channel configuration with friendly error messages
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
