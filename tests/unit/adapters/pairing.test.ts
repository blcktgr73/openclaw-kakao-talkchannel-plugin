/**
 * ChannelPairingAdapter tests
 *
 * Tests for pairingAdapter implementation with 5+ test cases covering:
 * - idLabel: returns "kakaoUserId"
 * - normalizeAllowEntry: removes kakao: or kakaotalk: prefix (case-insensitive)
 * - notifyApproval: logs approval message with user ID via runtime logger
 * - Edge cases: empty strings, whitespace, mixed case prefixes
 * - Approval message format: correct Korean message
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  pairingAdapter,
  PAIRING_APPROVED_MESSAGE,
  type PairingNotifyContext,
} from "../../../src/adapters/pairing";
import {
  setKakaoRuntime,
  clearKakaoRuntime,
} from "../../../src/runtime";

describe("ChannelPairingAdapter", () => {
  describe("idLabel", () => {
    it("should return 'kakaoUserId' as the ID label", () => {
      expect(pairingAdapter.idLabel).toBe("kakaoUserId");
    });
  });

  describe("normalizeAllowEntry", () => {
    it("should remove 'kakao:' prefix from entry", () => {
      const result = pairingAdapter.normalizeAllowEntry("kakao:user123");
      expect(result).toBe("user123");
    });

    it("should remove 'kakaotalk:' prefix from entry", () => {
      const result = pairingAdapter.normalizeAllowEntry("kakaotalk:user456");
      expect(result).toBe("user456");
    });

    it("should handle case-insensitive prefix removal (KAKAO:)", () => {
      const result = pairingAdapter.normalizeAllowEntry("KAKAO:user789");
      expect(result).toBe("user789");
    });

    it("should handle case-insensitive prefix removal (KakaoTalk:)", () => {
      const result = pairingAdapter.normalizeAllowEntry("KakaoTalk:user999");
      expect(result).toBe("user999");
    });

    it("should trim whitespace from normalized entry", () => {
      const result = pairingAdapter.normalizeAllowEntry("  kakao:user123  ");
      expect(result).toBe("user123");
    });

    it("should return entry unchanged if no prefix present", () => {
      const result = pairingAdapter.normalizeAllowEntry("user123");
      expect(result).toBe("user123");
    });

    it("should handle empty string after prefix removal", () => {
      const result = pairingAdapter.normalizeAllowEntry("kakao:");
      expect(result).toBe("");
    });

    it("should handle multiple colons in entry", () => {
      const result = pairingAdapter.normalizeAllowEntry("kakao:user:123");
      expect(result).toBe("user:123");
    });
  });

  describe("notifyApproval", () => {
    let mockLogger: {
      info: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      setKakaoRuntime({
        logger: mockLogger,
      } as unknown as Parameters<typeof setKakaoRuntime>[0]);
    });

    afterEach(() => {
      clearKakaoRuntime();
    });

    it("should log approval notification with user ID", async () => {
      const ctx: PairingNotifyContext = {
        cfg: {},
        id: "user123",
      };

      await pairingAdapter.notifyApproval(ctx);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("[kakao:pairing]")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("user123")
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(PAIRING_APPROVED_MESSAGE)
      );
    });

    it("should include approval message in notification", async () => {
      const ctx: PairingNotifyContext = {
        cfg: {},
        id: "user456",
      };

      await pairingAdapter.notifyApproval(ctx);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("OpenClaw 연동이 승인되었습니다")
      );
    });

    it("should handle context with accountId", async () => {
      const ctx: PairingNotifyContext = {
        cfg: {},
        id: "user789",
        accountId: "default",
      };

      await pairingAdapter.notifyApproval(ctx);

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("should handle context with cfg object", async () => {
      const ctx: PairingNotifyContext = {
        cfg: { channelId: "channel123", mode: "relay" },
        id: "user999",
      };

      await pairingAdapter.notifyApproval(ctx);

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it("should be an async function", async () => {
      const ctx: PairingNotifyContext = {
        cfg: {},
        id: "user123",
      };

      const result = pairingAdapter.notifyApproval(ctx);

      expect(result).toBeInstanceOf(Promise);

      await result;
    });

    it("should not throw when runtime is not initialized", async () => {
      clearKakaoRuntime();

      const ctx: PairingNotifyContext = {
        cfg: {},
        id: "user123",
      };

      await expect(pairingAdapter.notifyApproval(ctx)).resolves.not.toThrow();
    });
  });

  describe("PAIRING_APPROVED_MESSAGE", () => {
    let mockLogger: {
      info: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      setKakaoRuntime({
        logger: mockLogger,
      } as unknown as Parameters<typeof setKakaoRuntime>[0]);
    });

    afterEach(() => {
      clearKakaoRuntime();
    });

    it("should contain the correct Korean approval message", () => {
      expect(PAIRING_APPROVED_MESSAGE).toBe(
        "✅ OpenClaw 연동이 승인되었습니다. 이제 대화를 시작할 수 있습니다."
      );
    });

    it("should be used in notifyApproval", async () => {
      const ctx: PairingNotifyContext = {
        cfg: {},
        id: "user123",
      };

      await pairingAdapter.notifyApproval(ctx);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(PAIRING_APPROVED_MESSAGE)
      );
    });
  });

  describe("Integration", () => {
    let mockLogger: {
      info: ReturnType<typeof vi.fn>;
      warn: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      setKakaoRuntime({
        logger: mockLogger,
      } as unknown as Parameters<typeof setKakaoRuntime>[0]);
    });

    afterEach(() => {
      clearKakaoRuntime();
    });

    it("should work together: normalize entry and notify approval", async () => {
      const normalizedId = pairingAdapter.normalizeAllowEntry("kakao:user123");
      expect(normalizedId).toBe("user123");

      const ctx: PairingNotifyContext = {
        cfg: {},
        id: normalizedId,
      };

      await pairingAdapter.notifyApproval(ctx);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("user123")
      );
    });

    it("should have correct idLabel for use in pairing context", () => {
      expect(pairingAdapter.idLabel).toBe("kakaoUserId");
      expect(typeof pairingAdapter.idLabel).toBe("string");
    });
  });
});
