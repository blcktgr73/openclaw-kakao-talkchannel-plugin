/**
 * Runtime abstraction tests
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { setKakaoRuntime, getKakaoRuntime } from "../../src/runtime";
import type { PluginRuntime } from "openclaw/plugin-sdk";

// Mock PluginRuntime for testing
const createMockRuntime = (): PluginRuntime => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  // Add other required properties as needed
} as unknown as PluginRuntime);

describe("Runtime Abstraction", () => {
  beforeEach(() => {
    // Reset runtime state between tests by setting to a new mock
    // Note: This relies on the module being re-evaluated or having a reset function
  });

  describe("setKakaoRuntime", () => {
    it("should set the runtime without throwing", () => {
      const mockRuntime = createMockRuntime();
      expect(() => setKakaoRuntime(mockRuntime)).not.toThrow();
    });
  });

  describe("getKakaoRuntime", () => {
    it("should return the runtime after it is set", () => {
      const mockRuntime = createMockRuntime();
      setKakaoRuntime(mockRuntime);

      const result = getKakaoRuntime();
      expect(result).toBe(mockRuntime);
    });

    it("should throw if runtime is not initialized", async () => {
      // Import fresh module to test uninitialized state
      vi.resetModules();
      const { getKakaoRuntime: freshGet } = await import("../../src/runtime");

      expect(() => freshGet()).toThrow("Kakao runtime not initialized");
    });
  });

  describe("runtime logger", () => {
    it("should provide access to logger methods", () => {
      const mockRuntime = createMockRuntime();
      setKakaoRuntime(mockRuntime);

      const runtime = getKakaoRuntime();
      expect(runtime.logger).toBeDefined();
      expect(typeof runtime.logger.info).toBe("function");
      expect(typeof runtime.logger.error).toBe("function");
    });
  });
});
