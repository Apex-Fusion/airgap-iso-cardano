# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Features

### Cryptographic Security

- **Ed25519 Signatures**: All signatures use Ed25519 via audited WASM library
- **BIP39 Mnemonic Generation**: 256-bit entropy for seed generation
- **CIP-1852 Key Derivation**: Standard Cardano HD wallet derivation
- **WASM Isolation**: Cryptographic operations in WebAssembly sandbox
- **Memory Protection**: Secure wiping of sensitive data

### AirGap Compliance

- **Offline Operation**: Module functions without network connectivity
- **No Telemetry**: Zero data collection or external communication
- **Isolated Execution**: Compatible with AirGap Vault's security model
- **Deterministic Builds**: Reproducible artifacts for verification

### Input Validation

- **Address Validation**: Comprehensive Cardano address verification
- **Amount Validation**: Safe numeric operations and overflow protection
- **Data Sanitization**: Input cleaning and validation
- **Rate Limiting**: Protection against abuse via Bottleneck

## Security Architecture

### WASM Security Model

```typescript
// Secure WASM initialization
async function initializeCardanoWasm(): Promise<any> {
  if (CardanoWasm) return CardanoWasm;
  
  try {
    const wasmModule = await import('@dcspark/cardano-multiplatform-lib-browser');
    return wasmModule;
  } catch (error) {
    throw new Error(`WASM initialization failed: ${error.message}`);
  }
}
```

### Key Management

- **Private Key Handling**: Keys never leave secure WASM context
- **Derivation Security**: CIP-1852 compliant derivation paths
- **Memory Cleanup**: Automatic cleanup of sensitive data
- **Entropy Sources**: Cryptographically secure random generation

### Network Security

- **Multi-Provider Failover**: No single point of failure
- **Rate Limiting**: Per-provider request throttling  
- **Input Validation**: All external data validated
- **Error Handling**: Secure error messages without data leakage

## Reporting a Vulnerability

### Security Contact

Please report security vulnerabilities privately to maintain responsible disclosure:

- **Email**: [security@airgap.it](mailto:security@airgap.it)
- **Subject**: "AirGap Cardano Module Security Report"

### What to Include

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential security impact and affected versions  
3. **Reproduction**: Steps to reproduce the issue
4. **Environment**: Testing environment details
5. **Suggestion**: Potential mitigation or fix (if known)

### Response Timeline

- **Initial Response**: Within 24 hours
- **Assessment**: Within 72 hours
- **Fix Development**: Within 2 weeks for critical issues
- **Public Disclosure**: After fix is deployed and tested

### Vulnerability Categories

#### Critical (Immediate Response)
- Private key exposure or theft
- Signature verification bypass
- Seed phrase generation weakness
- Remote code execution

#### High (72 Hour Response)
- Transaction manipulation
- Address generation flaws
- WASM sandbox escape
- Denial of service attacks

#### Medium (1 Week Response)
- Input validation bypass
- Information disclosure
- Cache poisoning
- Rate limiting bypass

#### Low (2 Week Response)
- Minor information leakage
- Documentation errors
- Non-security bugs

## Security Testing

### Automated Security Testing

```bash
# Security-focused test suite
npm test -- --testNamePattern="security|crypto|validation"

# Dependency vulnerability scan
npm audit

# Type safety verification
npm run typecheck
```

### Manual Security Review

1. **Code Review**: Security-focused code review process
2. **Crypto Audit**: Cryptographic implementation verification
3. **WASM Analysis**: WebAssembly security boundary testing
4. **Integration Testing**: AirGap Vault integration security

### Security Test Coverage

- **Ed25519 Signature Tests**: Comprehensive signature verification
- **BIP39 Entropy Tests**: Mnemonic generation randomness verification
- **Key Derivation Tests**: CIP-1852 compliance and security
- **Input Validation Tests**: Malformed input handling
- **Memory Safety Tests**: Sensitive data cleanup verification

## Dependencies Security

### Production Dependencies

| Package | Purpose | Security Notes |
|---------|---------|----------------|
| `@dcspark/cardano-multiplatform-lib-browser` | Crypto operations | Audited WASM library |
| `@noble/hashes` | Hash functions | Minimal, audited crypto |
| `@scure/bip39` | BIP39 implementation | Secure mnemonic handling |
| `bech32` | Address encoding | Standard implementation |
| `bottleneck` | Rate limiting | DoS protection |

### Security Update Process

1. **Monitoring**: Automated vulnerability scanning
2. **Assessment**: Security impact evaluation
3. **Testing**: Compatibility and regression testing
4. **Deployment**: Secure update deployment
5. **Verification**: Post-update security validation

## AirGap Security Model

### Isolation Requirements

- **Network Isolation**: No network access required
- **File System**: No file system access needed
- **External APIs**: Optional for enhanced features only
- **Crypto Operations**: Self-contained via WASM

### Threat Model

#### Threats Mitigated

- **Private Key Theft**: Keys never leave WASM context
- **Transaction Tampering**: Cryptographic signature verification
- **Replay Attacks**: Nonce and timestamp validation
- **Man-in-the-Middle**: Offline operation capability

#### Assumptions

- **AirGap Vault Security**: Relies on AirGap Vault's isolation
- **WASM Security**: WebAssembly sandbox integrity
- **User Device Security**: Secure device environment
- **Physical Security**: Device physical protection

## Compliance

### Standards Compliance

- **CIP-1852**: HD Wallets for Cardano
- **CIP-19**: Cardano Addresses
- **CIP-14**: Asset Fingerprint
- **BIP39**: Mnemonic Seed Phrases
- **BIP32**: Hierarchical Deterministic Wallets

### Security Frameworks

- **OWASP**: Web Application Security guidelines
- **NIST**: Cryptographic standards compliance
- **Common Criteria**: Security evaluation criteria
- **ISO 27001**: Information security management

## Security Changelog

### Version 1.0.0

- **Added**: WASM-based cryptographic operations
- **Added**: Ed25519 signature support
- **Added**: BIP39 mnemonic generation
- **Added**: CIP-1852 key derivation
- **Added**: Multi-provider rate limiting
- **Added**: Comprehensive input validation
- **Security**: Complete browser compatibility without Node.js

## Contact

For security-related questions or concerns:

- **Security Team**: security@airgap.it
- **General Support**: support@airgap.it
- **GitHub Issues**: For non-security bugs only

## Acknowledgments

We thank the security research community for responsible disclosure and the open-source projects that make this module secure:

- **Cardano Foundation**: For cryptographic standards
- **DC SPARK**: For the WASM crypto library
- **Noble Crypto**: For audited hash functions
- **Scure**: For secure BIP39 implementation