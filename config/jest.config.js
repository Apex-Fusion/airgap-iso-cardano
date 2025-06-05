module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/../src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    '../src/**/*.ts',
    '!../src/**/*.d.ts',
    '!../src/**/*.test.ts',
    '!../src/index.simple.ts',
    '!../src/index.ultra-simple.ts'
  ],
  // Handle ES modules from @noble libraries and mock WASM modules
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|@scure)/)'
  ],
  // Mock WASM and browser-only modules (removed unused mappings)
  moduleNameMapper: {},
  // Set NODE_ENV to test to use mock crypto implementations
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Prevent worker process leaks
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true
};