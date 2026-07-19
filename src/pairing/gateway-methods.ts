/**
 * Gateway RPC methods for pairing.
 *
 * These run **inside the gateway process**, which is the only place the live
 * pairing state exists. The CLI (a separate process) reaches them through
 * `runtime.gateway.request`, and they are also callable directly:
 *
 *     openclaw gateway call kakao.pairing.status
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import {
  getPairingSnapshot,
  listPairingSnapshots,
  requestNewPairing,
  type PairingSnapshot,
} from "./registry.js";

export const PAIRING_STATUS_METHOD = "kakao.pairing.status";
export const PAIRING_NEW_METHOD = "kakao.pairing.new";

/** Upper bound on how long `kakao.pairing.new` waits for the relay. */
export const MAX_REISSUE_TIMEOUT_MS = 120_000;
export const DEFAULT_REISSUE_TIMEOUT_MS = 30_000;

export interface PairingStatusResult {
  accounts: PairingSnapshot[];
  account: PairingSnapshot | null;
}

export interface PairingNewResult {
  account: PairingSnapshot;
}

function readAccountId(params: unknown): string | undefined {
  if (!params || typeof params !== "object") return undefined;
  const value = (params as { accountId?: unknown }).accountId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readTimeoutMs(params: unknown): number {
  if (!params || typeof params !== "object") return DEFAULT_REISSUE_TIMEOUT_MS;
  const value = (params as { timeoutMs?: unknown }).timeoutMs;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REISSUE_TIMEOUT_MS;
  }
  return Math.min(value, MAX_REISSUE_TIMEOUT_MS);
}

export function handlePairingStatus(params: unknown): PairingStatusResult {
  const accountId = readAccountId(params);
  return {
    accounts: listPairingSnapshots(),
    account: getPairingSnapshot(accountId),
  };
}

export async function handlePairingNew(params: unknown): Promise<PairingNewResult> {
  const account = await requestNewPairing(readAccountId(params), readTimeoutMs(params));
  return { account };
}

export function registerPairingGatewayMethods(api: OpenClawPluginApi): void {
  // Reading a pairing code is an operator-read action; issuing a new one
  // invalidates the current session, so it is a write.
  api.registerGatewayMethod(
    PAIRING_STATUS_METHOD,
    (ctx) => handlePairingStatus(ctx.params),
    { scope: "operator.read" }
  );

  api.registerGatewayMethod(
    PAIRING_NEW_METHOD,
    (ctx) => handlePairingNew(ctx.params),
    { scope: "operator.write" }
  );
}
