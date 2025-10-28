import { vi } from 'vitest';

// Mock process.env for tests
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};
