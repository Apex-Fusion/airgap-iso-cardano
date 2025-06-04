# Changelog

All notable changes to the AirGap Cardano Isolated Module will be documented in this file.

## [1.0.0] - 2024-XX-XX

### Added
- Browser-compatible Cardano protocol module for AirGap Vault
- WASM-based cryptographic operations using @dcspark/cardano-multiplatform-lib-browser
- Async WASM initialization for fast AirGap integration
- Multi-provider data services (Koios, CardanoScan, Blockfrost)
- Comprehensive test suite with 208/208 tests passing
- Next-generation mobile testing infrastructure with MicroVMs
- Nix flakes + Earthly CI/CD pipeline
- Production-ready module signing and packaging

### Changed
- Migrated from cardano-crypto.js to browser-compatible WASM library
- Enhanced error handling with proper async/await patterns
- Improved module loading performance with WASM pre-initialization

### Security
- Ed25519 signature verification via WASM
- BIP39 mnemonic generation with 256-bit entropy
- Secure key derivation following CIP-1852
- Memory protection with secure wiping
- Rate limiting and input validation