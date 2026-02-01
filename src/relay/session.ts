/**
 * Relay Server Session API Client
 *
 * Handles session creation and management for relay mode.
 * Sessions are created without authentication and provide:
 * - sessionToken: For SSE connection authentication
 * - pairingCode: For users to enter in KakaoTalk
 */

import { DEFAULT_RELAY_URL } from "../config/schema.js";

export type SessionStatus = "pending_pairing" | "paired" | "expired" | "disconnected";

export interface CreateSessionResponse {
  sessionToken: string;
  pairingCode: string;
  expiresIn: number;
  status: SessionStatus;
}

export interface SessionStatusResponse {
  status: SessionStatus;
  pairedAt?: string;
  kakaoUserId?: string;
}

export interface CreateSessionError {
  code: string;
  message: string;
}

export type CreateSessionResult =
  | { ok: true; data: CreateSessionResponse }
  | { ok: false; error: CreateSessionError };

export type SessionStatusResult =
  | { ok: true; data: SessionStatusResponse }
  | { ok: false; error: CreateSessionError };

/**
 * Create a new session on the relay server
 *
 * @param relayUrl - Relay server URL (defaults to https://k.tess.dev/)
 * @returns Session token and pairing code
 */
export async function createSession(
  relayUrl: string = DEFAULT_RELAY_URL
): Promise<CreateSessionResult> {
  const url = normalizeRelayUrl(relayUrl);

  try {
    const response = await fetch(`${url}v1/sessions/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      return {
        ok: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.message ?? `Failed to create session: HTTP ${response.status}`,
        },
      };
    }

    const data = await response.json() as CreateSessionResponse;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Check the status of an existing session
 *
 * @param sessionToken - The session token to check
 * @param relayUrl - Relay server URL (defaults to https://k.tess.dev/)
 * @returns Current session status
 */
export async function checkSessionStatus(
  sessionToken: string,
  relayUrl: string = DEFAULT_RELAY_URL
): Promise<SessionStatusResult> {
  const url = normalizeRelayUrl(relayUrl);

  try {
    const response = await fetch(`${url}v1/sessions/${sessionToken}/status`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      return {
        ok: false,
        error: {
          code: `HTTP_${response.status}`,
          message: errorData.message ?? `Failed to check session: HTTP ${response.status}`,
        },
      };
    }

    const data = await response.json() as SessionStatusResponse;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Normalize relay URL to ensure it ends with a slash
 */
function normalizeRelayUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

// Re-export for consumers that import from this module
export { DEFAULT_RELAY_URL };
