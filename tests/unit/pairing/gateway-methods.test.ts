import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_REISSUE_TIMEOUT_MS,
  MAX_REISSUE_TIMEOUT_MS,
  PAIRING_NEW_METHOD,
  PAIRING_STATUS_METHOD,
  handlePairingNew,
  handlePairingStatus,
  registerPairingGatewayMethods,
} from "../../../src/pairing/gateway-methods";
import {
  __resetPairingRegistry,
  recordPairingRequired,
  registerAccount,
  type AccountController,
  type PairingSnapshot,
} from "../../../src/pairing/registry";

function makeController(
  requestNewPairing: AccountController["requestNewPairing"]
): AccountController {
  return { reissueBlockedReason: () => null, requestNewPairing };
}

describe("pairing gateway methods", () => {
  beforeEach(() => {
    __resetPairingRegistry();
  });

  describe("registration", () => {
    it("registers both methods with the right scopes", () => {
      const registerGatewayMethod = vi.fn();
      registerPairingGatewayMethods({ registerGatewayMethod } as never);

      expect(registerGatewayMethod).toHaveBeenCalledTimes(2);
      expect(registerGatewayMethod.mock.calls[0][0]).toBe(PAIRING_STATUS_METHOD);
      expect(registerGatewayMethod.mock.calls[0][2]).toEqual({ scope: "operator.read" });
      expect(registerGatewayMethod.mock.calls[1][0]).toBe(PAIRING_NEW_METHOD);
      expect(registerGatewayMethod.mock.calls[1][2]).toEqual({ scope: "operator.write" });
    });
  });

  describe("kakao.pairing.status", () => {
    it("returns nulls when nothing is running", () => {
      expect(handlePairingStatus(undefined)).toEqual({ accounts: [], account: null });
    });

    it("returns the requested account", () => {
      recordPairingRequired("a", "a", "CODE-A", 300);
      recordPairingRequired("b", "b", "CODE-B", 300);

      const result = handlePairingStatus({ accountId: "b" });

      expect(result.account?.pairingCode).toBe("CODE-B");
      expect(result.accounts).toHaveLength(2);
    });

    it("falls back to the first account when accountId is absent or blank", () => {
      recordPairingRequired("a", "a", "CODE-A", 300);

      expect(handlePairingStatus({}).account?.accountId).toBe("a");
      expect(handlePairingStatus({ accountId: "" }).account?.accountId).toBe("a");
      expect(handlePairingStatus("garbage").account?.accountId).toBe("a");
    });
  });

  describe("kakao.pairing.new", () => {
    function snapshotStub(): PairingSnapshot {
      return {
        accountId: "default",
        talkchannelId: "default",
        state: "pending",
        pairingCode: "CODE-NEW",
        expiresAt: Date.now() + 300_000,
        expiresInSeconds: 300,
        issuedAt: Date.now(),
        pairedUserId: null,
        pairedAt: null,
        canReissue: true,
        reissueBlockedReason: null,
      };
    }

    it("returns the freshly issued snapshot", async () => {
      registerAccount("default", "default", makeController(async () => snapshotStub()));

      await expect(handlePairingNew({})).resolves.toEqual({ account: snapshotStub() });
    });

    it("uses the default timeout when none is given", async () => {
      const requestNewPairing = vi.fn(async () => snapshotStub());
      registerAccount("default", "default", makeController(requestNewPairing));

      await handlePairingNew({});

      expect(requestNewPairing).toHaveBeenCalledWith(DEFAULT_REISSUE_TIMEOUT_MS);
    });

    it("clamps an oversized timeout", async () => {
      const requestNewPairing = vi.fn(async () => snapshotStub());
      registerAccount("default", "default", makeController(requestNewPairing));

      await handlePairingNew({ timeoutMs: 10 * 60 * 1000 });

      expect(requestNewPairing).toHaveBeenCalledWith(MAX_REISSUE_TIMEOUT_MS);
    });

    it.each([0, -1, Number.NaN, "30000", null])(
      "falls back to the default for an invalid timeout (%s)",
      async (timeoutMs) => {
        const requestNewPairing = vi.fn(async () => snapshotStub());
        registerAccount("default", "default", makeController(requestNewPairing));

        await handlePairingNew({ timeoutMs });

        expect(requestNewPairing).toHaveBeenCalledWith(DEFAULT_REISSUE_TIMEOUT_MS);
      }
    );

    it("propagates a blocked re-issue as an error", async () => {
      registerAccount("default", "default", {
        reissueBlockedReason: () => "uses a configured relayToken",
        requestNewPairing: vi.fn(),
      });

      await expect(handlePairingNew({})).rejects.toThrow(/uses a configured relayToken/);
    });
  });
});
