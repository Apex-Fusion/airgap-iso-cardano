# Contributing to AirGap Cardano Module

Thank you for your interest in contributing to the AirGap Cardano isolated module!

## Development Setup

### Prerequisites

- **Nix** (recommended) or Node.js 20+
- **Git** for version control

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd airgap-iso-cardano

# Enter development environment (Nix)
nix develop

# Install dependencies
npm install

# Run tests
npm test

# Build module
npm run build:bundle
```

## Development Workflow

### 1. Environment Setup

**Option A: Nix (Recommended)**
```bash
nix develop  # Provides Node.js 20, TypeScript, and all tools
```

**Option B: Manual Setup**
```bash
node --version  # Should be 20+
npm install
```

### 2. Testing

```bash
# Run all tests (208 tests)
npm test

# Watch mode during development
npm run test:watch

# Coverage report
npm run test:coverage

# Security-focused tests
npm test -- --testNamePattern="security|crypto|validation"
```

### 3. Building

```bash
# TypeScript compilation
npm run build

# Browser bundle for AirGap
npm run build:bundle

# Complete AirGap module (signed ZIP)
npm run bundle:airgap:zip
```

## Code Standards

### TypeScript Guidelines

- **Strict Mode**: All code must compile with TypeScript strict mode
- **Type Safety**: Avoid `any` types except in tests or mocks
- **Async/Await**: Use async/await patterns for all asynchronous operations
- **Error Handling**: Comprehensive error handling with proper error types

### Testing Requirements

- **Test Coverage**: New features must include tests
- **100% Pass Rate**: All tests must pass before submitting
- **Mocking**: Use proper Jest mocks for external dependencies
- **Security Tests**: Include security-focused test cases

### Browser Compatibility

- **WASM Only**: Use `@dcspark/cardano-multiplatform-lib-browser` for crypto
- **No Node.js**: Avoid Node.js-specific libraries
- **Async Loading**: Implement proper WASM initialization
- **Bundle Format**: Maintain IIFE bundle compatibility

## Architecture Guidelines

### Core Principles

1. **AirGap Compliance**: Module must work in isolated environments
2. **Browser Compatibility**: Full browser support without Node.js dependencies
3. **Security First**: All cryptographic operations via audited WASM
4. **Performance**: Optimize for fast loading and execution

### File Organization

```
src/
├── crypto/           # WASM-based cryptographic operations
├── protocol/         # Cardano protocol implementations  
├── transaction/      # Transaction building and utilities
├── data/            # Multi-provider data services
├── utils/           # Address, validation, security utilities
└── types/           # TypeScript type definitions
```

### Dependencies

- **Core**: `@dcspark/cardano-multiplatform-lib-browser` for all crypto
- **Utilities**: `@noble/hashes`, `@scure/bip39`, `bech32`
- **Framework**: `@airgap/module-kit` for AirGap integration
- **Testing**: Jest with TypeScript support

## Submission Guidelines

### Before Submitting

1. **Run Tests**: `npm test` (all 208 tests must pass)
2. **Check Types**: `npm run typecheck`
3. **Lint Code**: `npm run lint`
4. **Build Module**: `npm run bundle:airgap:zip`
5. **Test in AirGap**: Verify module loads correctly

### Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch
3. **Implement** your changes with tests
4. **Document** any new functionality
5. **Submit** pull request with clear description

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add support for multi-signature transactions
fix: resolve WASM loading timeout in mobile browsers
docs: update API documentation for new features
test: add comprehensive security test suite
```

## Security Considerations

### Cryptographic Operations

- **WASM Only**: All crypto via `@dcspark/cardano-multiplatform-lib-browser`
- **Key Management**: Secure key derivation following CIP-1852
- **Memory Safety**: Proper cleanup of sensitive data
- **Entropy**: Use cryptographically secure random number generation

### AirGap Compliance

- **Offline Operation**: Module must work without network access
- **No Telemetry**: No data collection or external communication
- **Isolated Execution**: Compatible with AirGap Vault's sandbox
- **Deterministic**: Reproducible builds and behavior

## Testing

### Test Categories

1. **Unit Tests**: Individual function and class testing
2. **Integration Tests**: Multi-component interaction testing
3. **Security Tests**: Cryptographic and security validation
4. **Browser Tests**: Compatibility and performance testing

### Mock Strategy

- **WASM Mocking**: Use `src/__tests__/mocks/cardano-wasm-mock.ts`
- **Network Mocking**: Mock external API calls
- **Crypto Mocking**: Mock sensitive operations in tests

## Performance Guidelines

### WASM Optimization

- **Pre-loading**: Initialize WASM in module constructor
- **Lazy Loading**: Load WASM modules only when needed
- **Memory Management**: Proper cleanup of WASM resources
- **Bundle Size**: Minimize bundle size for fast loading

### Response Times

- **Module Loading**: < 100ms for `previewDynamicModule`
- **Transaction Building**: < 500ms for typical transactions
- **Address Generation**: < 50ms per address
- **Signature Verification**: < 100ms per signature

## Documentation

### Code Documentation

- **JSDoc Comments**: Document all public APIs
- **Type Annotations**: Complete TypeScript types
- **README Updates**: Keep README current with changes
- **Examples**: Provide usage examples for new features

### Testing Documentation

- **Test Descriptions**: Clear test case descriptions
- **Setup Instructions**: Document test environment setup
- **Coverage Reports**: Maintain high test coverage

## Getting Help

### Resources

- **AirGap Documentation**: Official AirGap Vault documentation
- **Cardano CIPs**: Cardano Improvement Proposals
- **CML Documentation**: Cardano Multiplatform Library docs
- **Jest Testing**: Jest framework documentation

### Community

- **Issues**: Use GitHub issues for bug reports
- **Discussions**: Use GitHub discussions for questions
- **Security**: Report security issues privately

## License

By contributing, you agree that your contributions will be licensed under the MIT License.