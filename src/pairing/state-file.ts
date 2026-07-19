/**
 * On-disk hand-off between the gateway process and the CLI process.
 *
 * The CLI cannot call into a running gateway. `runtime.gateway` is explicitly
 * scoped to code that "owns an active Gateway request context" — i.e. plugin
 * code already executing inside the gateway — and the host's own `callGateway`
 * helper is not exported from `openclaw/plugin-sdk`. So the two processes share
 * state through files, the same way the host shares gateway runtime state.
 *
 * Two files, each single-writer:
 *
 * - `pairing-state.json`  — written by the gateway, read by the CLI.
 * - `pairing-request.json` — written by the CLI, consumed by the gateway.
 *
 * Single-writer per file is deliberate: atomic rename prevents torn reads but
 * not lost updates, so nothing here does read-modify-write across processes.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PairingSnapshot } from "./registry.js";

export const STATE_FILE = "pairing-state.json";
export const REQUEST_FILE = "pairing-request.json";

/** A state file older than this is reported as stale rather than trusted. */
export const STATE_STALE_AFTER_MS = 60_000;

export interface PairingStateFile {
  /** Gateway process that wrote this. Lets the CLI detect a dead writer. */
  pid: number;
  /** Epoch ms of the last write. */
  updatedAt: number;
  accounts: PairingSnapshot[];
}

export interface PairingRequestFile {
  id: string;
  requestedAt: number;
  accountId?: string;
  timeoutMs: number;
}

export function resolveStateDir(): string {
  // Mirrors the host: OPENCLAW_HOME, else the OS home directory.
  const home = process.env.OPENCLAW_HOME || os.homedir();
  return path.join(home, ".openclaw", "kakao-talkchannel");
}

function filePath(name: string): string {
  return path.join(resolveStateDir(), name);
}

/**
 * Write atomically, then restrict permissions.
 *
 * Pairing codes are short-lived credentials, so the file is 0600. `chmod` is
 * best-effort — it is a no-op on Windows.
 */
function writeAtomic(target: string, data: unknown): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;

  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
  try {
    fs.renameSync(tmp, target);
  } catch {
    // Windows can refuse a rename over an open handle; the copy is still atomic
    // enough for our single-writer usage.
    fs.copyFileSync(tmp, target);
    fs.rmSync(tmp, { force: true });
  }
  try {
    fs.chmodSync(target, 0o600);
  } catch {
    // Windows / restricted filesystems.
  }
}

function readJson<T>(target: string): T | null {
  try {
    const raw = fs.readFileSync(target, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    // Absent, unreadable, or mid-write garbage — all mean "nothing to act on".
    return null;
  }
}

// -- state: gateway writes, CLI reads --------------------------------------

export function writePairingState(accounts: PairingSnapshot[]): void {
  writeAtomic(filePath(STATE_FILE), {
    pid: process.pid,
    updatedAt: Date.now(),
    accounts,
  } satisfies PairingStateFile);
}

export function readPairingState(): PairingStateFile | null {
  return readJson<PairingStateFile>(filePath(STATE_FILE));
}

export function clearPairingState(): void {
  removeQuietly(filePath(STATE_FILE));
}

/**
 * Delete without ever throwing.
 *
 * `force: true` only suppresses ENOENT — a locked or permission-denied file
 * still throws (EPERM on Windows, EACCES elsewhere). These deletes run during
 * account shutdown, where an exception would mask the real error.
 */
function removeQuietly(target: string): void {
  try {
    fs.rmSync(target, { force: true });
  } catch {
    // Best effort. A stale file is caught by the staleness check on read.
  }
}

/** True when the writing gateway looks gone or the file has gone quiet. */
export function isStateStale(state: PairingStateFile, now = Date.now()): boolean {
  if (now - state.updatedAt > STATE_STALE_AFTER_MS) return true;
  return !isProcessAlive(state.pid);
}

function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    // Signal 0 performs the permission/existence check without delivering.
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

// -- request: CLI writes, gateway consumes ---------------------------------

export function writePairingRequest(
  accountId: string | undefined,
  timeoutMs: number
): PairingRequestFile {
  const request: PairingRequestFile = {
    id: randomUUID(),
    requestedAt: Date.now(),
    accountId,
    timeoutMs,
  };
  writeAtomic(filePath(REQUEST_FILE), request);
  return request;
}

/**
 * Read and delete a pending request.
 *
 * Consuming on read keeps a request from being replayed. A request the gateway
 * never saw — because it was not running — must not fire later out of context,
 * which is why the adapter also clears the file on startup.
 */
export function consumePairingRequest(): PairingRequestFile | null {
  const target = filePath(REQUEST_FILE);
  const request = readJson<PairingRequestFile>(target);
  removeQuietly(target);
  return request;
}

export function clearPairingRequest(): void {
  removeQuietly(filePath(REQUEST_FILE));
}
