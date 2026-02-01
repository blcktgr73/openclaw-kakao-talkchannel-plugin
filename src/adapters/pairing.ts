/**
 * Kakao Channel Pairing Adapter
 *
 * Handles user pairing for dmPolicy="pairing" mode.
 */

import { getKakaoRuntime } from "../runtime.js";

export interface PairingNotifyContext {
  cfg: unknown;
  id: string;
  accountId?: string;
}

export const PAIRING_APPROVED_MESSAGE =
  "✅ OpenClaw 연동이 승인되었습니다. 이제 대화를 시작할 수 있습니다.";

export const pairingAdapter = {
  idLabel: "kakaoUserId",

  normalizeAllowEntry: (entry: string): string => {
    return entry.trim().replace(/^(kakao|kakaotalk):/i, "").trim();
  },

  notifyApproval: async (ctx: PairingNotifyContext): Promise<void> => {
    try {
      const runtime = getKakaoRuntime();
      runtime.logger.info(
        `[kakao:pairing] Approval notification for user ${ctx.id}: ${PAIRING_APPROVED_MESSAGE}`
      );
    } catch {
      // Runtime not initialized - skip logging in test environment
    }
  },
};
