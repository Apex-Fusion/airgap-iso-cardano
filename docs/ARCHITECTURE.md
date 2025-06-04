# AirGap Cardano Module Architecture

## Overview

The AirGap Cardano module is designed to work within AirGap Vault's restrictive WebView environment, providing secure offline Cardano transaction signing and address generation.

## AirGap Environment Constraints

### Security-First Architecture

AirGap Vault operates in a deliberately restricted environment for maximum security:

- **Limited Web APIs**: TextDecoder/TextEncoder not available
- **Vintage Dependencies**: Only 2019-2021 library versions supported
- **No Modern Crypto APIs**: Restricted for security reasons
- **Deterministic Environment**: Ensures consistent behavior across devices

### Why These Constraints Exist

1. **Attack Surface Reduction**: Modern Web APIs provide more attack vectors
2. **Isolation**: Prevents modules from accessing dangerous browser capabilities
3. **Air-Gap Compliance**: Maximum isolation from modern browser capabilities
4. **Proven Stability**: 2019-2021 crypto libraries have battle-tested security

## TextEncoder/TextDecoder Polyfill Solution

### Implementation

The module includes an automatic polyfill for TextEncoder/TextDecoder compatibility:

```typescript
// src/utils/text-encoder-polyfill.ts
export function installTextEncoderPolyfill(): void {
  if (typeof globalThis.TextEncoder === 'undefined') {
    // Install minimal UTF-8 encoder/decoder
    globalThis.TextEncoder = TextEncoderPolyfill;
    globalThis.TextDecoder = TextDecoderPolyfill;
  }
}

// src/index.ts - Automatic installation
import { installTextEncoderPolyfill } from './utils/text-encoder-polyfill';
installTextEncoderPolyfill();
```

### Polyfill Features

- **Minimal Implementation**: 2KB footprint
- **UTF-8 Support**: Complete encoding/decoding capability
- **Automatic Installation**: Works transparently
- **Zero Code Changes**: Existing code continues unchanged
- **Security Focused**: No external dependencies

## Compatible Dependencies

All dependencies are verified compatible with AirGap's restrictive environment:

```typescript
{
  "bip39": "^3.1.0",                    // ✅ BIP39 mnemonic support
  "@stricahq/bip32ed25519": "^2.1.1",   // ✅ Cardano key derivation
  "@stricahq/typhonjs": "^3.0.0",       // ✅ Transaction building
  "cbor-js": "^0.1.0",                  // ✅ CBOR serialization
  "@airgap/module-kit": "^0.13.21",     // ✅ AirGap integration
  "@stablelib/blake2b": "^1.0.1",       // ✅ Cryptographic hashing
  "@stablelib/ed25519": "^1.0.3"        // ✅ Digital signatures
}
```

## Core Architecture

### Module Structure

```
src/
├── index.ts                 # Main entry point with polyfill
├── crypto/                  # Cryptographic operations
│   ├── cardano-crypto.ts    # Ed25519, Blake2b, key derivation
│   └── index.ts             # Crypto exports
├── protocol/                # Cardano protocol implementation
│   └── cardano-protocol.ts  # Main protocol class
├── transaction/             # Transaction building
│   ├── transaction-builder.ts
│   ├── fee-estimation.ts
│   └── utxo-selector.ts
├── data/                    # Network data providers
│   └── cardano-data-service.ts
├── utils/                   # Utilities
│   ├── text-encoder-polyfill.ts
│   ├── address.ts
│   ├── validation.ts
│   └── logger.ts
└── types/                   # TypeScript definitions
    ├── cardano.ts
    └── domain.ts
```

### Key Components

#### CardanoProtocol Class
Implements both `AirGapOfflineProtocol` and `AirGapOnlineProtocol` interfaces:

- **Key Management**: CIP-1852 derivation, Ed25519 signatures
- **Address Generation**: Payment and staking addresses
- **Transaction Building**: CBOR serialization, fee estimation
- **Network Integration**: Multi-provider data service
- **Message Signing**: Blake2b hashing with Ed25519 signatures

#### CardanoDataService
Multi-provider network service with automatic failover:

- **Koios**: Primary public API
- **CardanoScan**: Backup block explorer API
- **Blockfrost**: Optional with API key
- **Offline Mode**: Graceful degradation when network unavailable

#### Transaction Builder
Comprehensive transaction construction:

- **UTXO Selection**: Automatic input selection algorithms
- **Fee Estimation**: Real-time parameter fetching with fallbacks
- **Multi-Asset Support**: Native tokens and NFTs
- **Delegation**: Staking certificate handling

## Build System

### Browser Compatibility

The module uses esbuild for browser-compatible bundling:

```javascript
// Build configuration
{
  format: 'iife',
  globalName: 'cardano',
  platform: 'browser',
  external: ['@airgap/module-kit']
}
```

### Module Signing

AirGap modules require cryptographic signatures:

1. **Bundle Creation**: IIFE format for browser execution
2. **Module Directory**: Files placed in `module/` subdirectory
3. **Manifest Generation**: Automatic metadata creation
4. **Digital Signing**: Ed25519 signature for integrity
5. **ZIP Packaging**: Final module for AirGap Vault

## Security Considerations

### Cryptographic Operations

- **Ed25519 Signatures**: Industry-standard elliptic curve cryptography
- **Blake2b Hashing**: Cardano-standard cryptographic hashing
- **BIP39 Mnemonics**: Secure seed phrase generation and validation
- **CIP-1852 Derivation**: Cardano-specific key derivation paths

### Memory Management

- **Secure Cleanup**: Automatic wiping of sensitive data
- **Minimal Footprint**: Efficient memory usage
- **No Memory Leaks**: Proper disposal of cryptographic materials

### Air-Gap Compliance

- **Offline Operation**: All crypto works without network
- **No External Dependencies**: Self-contained cryptographic implementation
- **Deterministic Behavior**: Consistent results across environments
- **Hardware Integration**: Compatible with secure hardware modules

## Testing Architecture

### Test Structure

```
test/
├── v1/                      # AirGap compatibility tests
│   ├── protocol.spec.ts     # Main protocol validation
│   ├── implementations.ts   # Test utilities and helpers
│   ├── specs/cardano.ts     # Protocol-specific test data
│   └── stubs/cardano.stub.ts # Network mocking
└── src/__tests__/           # Unit tests
    ├── crypto.test.ts
    ├── address.test.ts
    ├── transaction-builder.test.ts
    └── validation.test.ts
```

### Test Categories

- **Protocol Compliance**: AirGap interface validation
- **Cryptographic Testing**: Key generation, signing, verification
- **Transaction Testing**: Building, signing, detail extraction
- **Network Testing**: Data service integration with mocking
- **Error Handling**: Edge cases and failure scenarios

## Performance Considerations

### Optimization Strategies

- **Lazy Loading**: Components loaded on demand
- **Caching**: Network responses and computed values
- **Efficient Algorithms**: Optimized UTXO selection and fee estimation
- **Minimal Dependencies**: Reduced bundle size and attack surface

### Memory Efficiency

- **Streaming**: Large data processing without memory accumulation
- **Disposal**: Automatic cleanup of cryptographic materials
- **Pooling**: Reuse of computational resources where safe

## Deployment

### Module Installation

1. **Build**: `npm run bundle:airgap:zip`
2. **Transfer**: Copy ZIP to Android device
3. **Import**: Load via AirGap Vault settings
4. **Verification**: Signature validation and module loading

### Compatibility Matrix

| Component | Requirement | Status |
|-----------|-------------|---------|
| AirGap Vault | v3.0+ | ✅ Compatible |
| Android | 7.0+ | ✅ Compatible |
| iOS | 13.0+ | ✅ Compatible |
| Hardware | Secure Enclave | ✅ Required |
| Network | Optional | ✅ Graceful offline |