/**
 * Enhanced Jest Configuration for Comprehensive Testing
 */
module.exports = {
  ...require('./jest.config'),
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'html',
    'lcov',
    'json-summary',
    'cobertura'
  ],
  
  // Coverage thresholds - enforce high coverage
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    // Per-file thresholds for critical components
    './src/utils/security.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/utils/cardano-crypto-simplified.ts': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/protocol/cardano-protocol.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Setup files for enhanced testing
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup/test-setup.ts'
  ],
  
  // Test environment
  testEnvironment: 'node',
  
  // Additional configuration for security testing
  testTimeout: 30000, // Longer timeout for stress tests
  
  // Mock configuration
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output for debugging
  verbose: true
};