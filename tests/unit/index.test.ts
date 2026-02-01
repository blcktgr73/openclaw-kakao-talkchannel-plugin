/**
 * Plugin entry point tests (Simplified)
 *
 * Single channel, relay mode only.
 */

import { describe, it, expect, vi } from "vitest";
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

describe("Plugin Entry Point (Simplified)", () => {
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
    it("should call setKakaoRuntime and registerChannel", () => {
      const mockRuntime = createMockRuntime();
      const registerChannelMock = vi.fn();

      const api = {
        runtime: mockRuntime,
        config: {},
        registerChannel: registerChannelMock,
      };

      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

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
        config: {},
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

    it("should not register HTTP route (no direct mode)", () => {
      const mockRuntime = createMockRuntime();
      const registerChannelMock = vi.fn();
      const registerHttpRouteMock = vi.fn();

      const api = {
        runtime: mockRuntime,
        config: {},
        registerChannel: registerChannelMock,
        registerHttpRoute: registerHttpRouteMock,
      };

      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

      // HTTP route should NOT be registered (relay mode only)
      expect(registerHttpRouteMock).not.toHaveBeenCalled();
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
