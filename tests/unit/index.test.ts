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
        registerGatewayMethod: vi.fn(),
        registerCli: vi.fn(),
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
        registerGatewayMethod: vi.fn(),
        registerCli: vi.fn(),
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
        registerGatewayMethod: vi.fn(),
        registerCli: vi.fn(),
      };

      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

      // HTTP route should NOT be registered (relay mode only)
      expect(registerHttpRouteMock).not.toHaveBeenCalled();
    });

    it("should register both pairing gateway methods", () => {
      const registerGatewayMethod = vi.fn();
      const api = {
        runtime: createMockRuntime(),
        config: {},
        registerChannel: vi.fn(),
        registerGatewayMethod,
        registerCli: vi.fn(),
      };

      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

      const methods = registerGatewayMethod.mock.calls.map((call) => call[0]);
      expect(methods).toEqual(["kakao.pairing.status", "kakao.pairing.new"]);

      // Reading a code is a read; issuing one invalidates the session.
      expect(registerGatewayMethod.mock.calls[0][2]).toEqual({ scope: "operator.read" });
      expect(registerGatewayMethod.mock.calls[1][2]).toEqual({ scope: "operator.write" });
    });

    it("should register the kakao CLI with explicit command metadata", () => {
      const registerCli = vi.fn();
      const api = {
        runtime: createMockRuntime(),
        config: {},
        registerChannel: vi.fn(),
        registerGatewayMethod: vi.fn(),
        registerCli,
      };

      plugin.register(api as unknown as Parameters<typeof plugin.register>[0]);

      expect(registerCli).toHaveBeenCalledOnce();
      const [registrar, opts] = registerCli.mock.calls[0];
      expect(typeof registrar).toBe("function");
      // The host drops CLI registrations that omit this metadata.
      expect(opts.commands).toEqual(["kakao"]);
      expect(opts.descriptors[0]).toMatchObject({ name: "kakao", hasSubcommands: true });
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
