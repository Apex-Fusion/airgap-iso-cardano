module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/config/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/test/v1/**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts'
  ],
  moduleNameMapper: {
    '^@dcspark/cardano-multiplatform-lib-browser$': '<rootDir>/src/__tests__/mocks/cardano-wasm-mock.ts'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@dcspark|@airgap)/)'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: 'config/tsconfig.test.json'
    }]
  }
};