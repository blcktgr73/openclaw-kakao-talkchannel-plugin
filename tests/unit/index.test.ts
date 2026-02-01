/**
 * Plugin entry point tests
 *
 * Tests the main plugin export and its register function.
 * Verifies proper initialization of runtime and channel registration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PluginRuntime } from "openclaw/plugin-sdk";
import plugin from "../../index.js";

// Mock PluginRuntime for testing
const createMockRuntime = (): PluginRuntime => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
} as unknown as PluginRuntime);

describe("Plugin Entry Point", () => {
  describe("plugin object", () => {
    it("should have correct id", () => {
      expect(plugin.id).toBe("kakao-talkchannel");
    });

    it("should have correct name", () => {
      expect(plugin.name).toBe("Kakao TalkChannel");
    });

    it("should have correct description", () => {
      expect(plugin.description).toBe(
        "Kakao TalkChannel plugin for OpenClaw"
      );
    });

    it("should have configSchema defined", () => {
      expect(plugin.configSchema).toBeDefined();
    });

    it("should have register function", () => {
      expect(typeof plugin.register).toBe("function");
    });
  });

  describe("register function", () => {
    it("should call setKakaoRuntime with api.runtime", () => {
      const mockRuntime = createMockRuntime();
      const registerChannelMock = vi.fn();

      const api = {
        runtime: mockRuntime,
        registerChannel: registerChannelMock,
      };

      // Call register
      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

      // Verify registerChannel was called with kakaoPlugin
      expect(registerChannelMock).toHaveBeenCalledOnce();
      expect(registerChannelMock).toHaveBeenCalledWith({
        plugin: expect.objectContaining({
          id: "kakao-talkchannel",
        }),
      });
    });

    it("should register channel plugin with correct structure", () => {
      const mockRuntime = createMockRuntime();
      const registerChannelMock = vi.fn();

      const api = {
        runtime: mockRuntime,
        registerChannel: registerChannelMock,
      };

      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

      const callArgs = registerChannelMock.mock.calls[0][0];
      expect(callArgs.plugin).toHaveProperty("id", "kakao-talkchannel");
      expect(callArgs.plugin).toHaveProperty("meta");
      expect(callArgs.plugin).toHaveProperty("capabilities");
      expect(callArgs.plugin).toHaveProperty("config");
      expect(callArgs.plugin).toHaveProperty("outbound");
    });

    it("should initialize runtime before registering channel", () => {
      const mockRuntime = createMockRuntime();
      const callOrder: string[] = [];

      const registerChannelMock = vi.fn(() => {
        callOrder.push("registerChannel");
      });

      const api = {
        runtime: mockRuntime,
        registerChannel: registerChannelMock,
      };

      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

      // Verify registerChannel was called
      expect(callOrder).toContain("registerChannel");
    });
  });

  describe("plugin export", () => {
    it("should be the default export", () => {
      expect(plugin).toBeDefined();
      expect(plugin.id).toBe("kakao-talkchannel");
    });

    it("should have all required properties", () => {
      expect(plugin).toHaveProperty("id");
      expect(plugin).toHaveProperty("name");
      expect(plugin).toHaveProperty("description");
      expect(plugin).toHaveProperty("configSchema");
      expect(plugin).toHaveProperty("register");
    });
  });
});
