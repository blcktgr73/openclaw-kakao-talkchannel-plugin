/**
 * Vitest global test setup
 */
import { vi } from "vitest";

// Mock PluginRuntime for tests
export const createMockRuntime = () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  config: {},
});

// Reset all mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
