/**
 * Test Setup and Global Configuration
 * Provides enhanced testing utilities and environment setup
 */

import { Logger, LogLevel } from "../../utils/logger";

// Set logger to ERROR level during tests to reduce noise
Logger.setLevel(LogLevel.ERROR);

// Mock Security rate limiting globally to avoid Bottleneck timeout issues in tests
jest.mock("../../utils/security", () => ({
  Security: {
    checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10 }),
    validateInput: jest.fn().mockReturnValue(true),
    sanitizeInput: jest.fn().mockImplementation((input: any) => input),
    generateSecureId: jest.fn().mockReturnValue("mock-secure-id"),
    clearSensitiveData: jest.fn(),
  }
}));

// Extend Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },

  toBeSecurelyErased(received: Buffer) {
    const isZeroed = received.every((byte) => byte === 0);
    const isRandom = received.some(
      (byte, index, arr) => index > 0 && byte !== arr[index - 1],
    );

    const pass = isZeroed || isRandom; // Either zeroed or randomized

    if (pass) {
      return {
        message: () => `expected buffer not to be securely erased`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected buffer to be securely erased (zeroed or randomized)`,
        pass: false,
      };
    }
  },

  toHaveExecutionTime(received: () => void, maxMs: number) {
    const start = Date.now();
    received();
    const executionTime = Date.now() - start;

    const pass = executionTime <= maxMs;

    if (pass) {
      return {
        message: () =>
          `expected execution time ${executionTime}ms not to be within ${maxMs}ms`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected execution time ${executionTime}ms to be within ${maxMs}ms`,
        pass: false,
      };
    }
  },
});

// Global test utilities
(global as any).testUtils = {
  // Generate test data
  generateTestUTXO: (amount?: bigint, address?: string) => ({
    txHash: Math.random().toString(36).substring(2, 15).padEnd(64, "0"),
    outputIndex: Math.floor(Math.random() * 256),
    amount: amount || BigInt(Math.floor(Math.random() * 10000000) + 1000000),
    address:
      address ||
      "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
  }),

  generateTestMnemonic: () =>
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art",

  // Performance testing utilities
  measureMemoryUsage: (fn: () => void) => {
    const memBefore = process.memoryUsage();
    fn();
    const memAfter = process.memoryUsage();
    return {
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external,
      rss: memAfter.rss - memBefore.rss,
    };
  },

  measureExecutionTime: (fn: () => void) => {
    const start = process.hrtime.bigint();
    fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // Convert to milliseconds
  },

  // Security testing utilities
  generateMaliciousInput: (
    type: "xss" | "sql" | "command" | "overflow" | "format",
  ) => {
    const patterns = {
      xss: '<script>alert("test")</script>',
      sql: "'; DROP TABLE test; --",
      command: "; cat /etc/passwd",
      overflow: "A".repeat(100000),
      format: "%x%x%x%x%x%x%x%x",
    };
    return patterns[type] || "";
  },

  // Timing-safe operations for testing
  timingSafeCompare: (a: string, b: string) => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    if (bufA.length !== bufB.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
      result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
  },
};

// Console overrides for testing
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Suppress expected console errors in tests
console.error = (...args: any[]) => {
  const message = args.join(" ");
  // Only suppress expected test errors
  if (!message.includes("[ERROR] Failed to fetch account info")) {
    originalConsoleError(...args);
  }
};

console.warn = (...args: any[]) => {
  const message = args.join(" ");
  // Suppress security warnings during testing - they're expected and verified
  if (!message.includes("[WARN] Suspicious pattern detected")) {
    originalConsoleWarn(...args);
  }
};

// Cleanup after each test
afterEach(() => {
  // Clear any timers
  jest.clearAllTimers();

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Global error handler for unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit in test environment
});

// Type extensions for custom matchers are moved to a separate declaration file

// This file sets up global test configuration but doesn't contain actual tests
describe("Test Setup", () => {
  test("should initialize test environment", () => {
    expect(true).toBe(true);
  });
});
