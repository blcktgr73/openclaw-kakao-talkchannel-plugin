/**
 * Runtime abstraction for Kakao plugin
 *
 * Provides access to OpenClaw PluginRuntime after plugin initialization.
 * Pattern follows: /Users/joy/workspace/openclaw/extensions/telegram/src/runtime.ts
 */
import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

/**
 * Set the plugin runtime during initialization.
 * Called from index.ts register() function.
 */
export function setKakaoRuntime(next: PluginRuntime): void {
  runtime = next;
}

/**
 * Get the plugin runtime.
 * Throws if called before runtime is initialized.
 */
export function getKakaoRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Kakao runtime not initialized");
  }
  return runtime;
}

/**
 * Clear the plugin runtime.
 * Used for testing purposes only.
 */
export function clearKakaoRuntime(): void {
  runtime = null;
}
