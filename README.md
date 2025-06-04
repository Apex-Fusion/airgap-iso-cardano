# AirGap Cardano Isolated Module

A production-ready Cardano protocol module for AirGap Vault providing secure offline transaction signing and address generation.

## 🚀 Quick Start

### Using Nix (Recommended)

```bash
# Enter development environment
nix develop

# Setup project
nix run .#setup

# Build and create AirGap module
npm run bundle:airgap:zip

# Run tests (262 tests)
npm test
```

### Manual Setup

```bash
# Install dependencies
npm install

# Build module
npm run build:bundle
node scripts/build/sign-module.js
npm run bundle:airgap:zip
```

## 📱 Android Development

Deploy directly to connected Android devices:

```bash
# Build, sign and deploy to Android device
nix run .#deploy-android

# Check connected devices
adb devices
```

## 🔧 Core Features

- ✅ **Cardano Protocol Compliance** - CIP-1852, CIP-19 key derivation and addresses
- ✅ **Secure Cryptography** - Ed25519 signatures, BIP39 mnemonics, secure key handling
- ✅ **AirGap Compatible** - Automatic TextEncoder/TextDecoder polyfill for restrictive WebView environment
- ✅ **Multi-Provider Data** - Koios, CardanoScan, Blockfrost with automatic failover
- ✅ **Comprehensive Testing** - 43 AirGap compliance tests + 244 unit tests passing
- ✅ **Production Ready** - All 13 dependencies compatible, cryptographically signed modules

## 🏗️ Development Commands

```bash
# Development
npm test                     # Run test suite
npm run build               # TypeScript compilation  
npm run build:bundle        # Create browser bundle
npm run bundle:airgap:zip   # Create signed module ZIP

# Module signing
node scripts/build/sign-module.js --generate-keys  # Generate signing keys
node scripts/build/sign-module.js                  # Sign module

# Nix workflows
nix run .#dev               # Development workflow
nix run .#build             # Complete build pipeline
```

## 📦 Module Integration

### Import into AirGap Vault

1. Build the module: `npm run bundle:airgap:zip`
2. Transfer `build/airgap-iso-cardano.zip` to your Android device
3. In AirGap Vault: Settings → Isolated Modules → Import Module
4. Select the ZIP file to install the Cardano module

### Android Deployment

Use the automated deployment for faster testing:

```bash
# Automatic deployment to connected device
nix run .#deploy-android
```

This command will:
- Check for connected Android devices via ADB
- Build and sign the module automatically  
- Upload directly to the device Downloads folder
- Provide instructions for importing in AirGap Vault

## 🔒 Security

### Cryptographic Operations
- **Ed25519 signatures** using @stablelib/ed25519 (AirGap-compatible)
- **BIP39 mnemonic generation** with proper entropy
- **CIP-1852 key derivation** for Cardano standard paths
- **Secure memory handling** with automatic cleanup

### AirGap Vault Compatibility
- **Offline operation** - All crypto works without network
- **Module signing** - Cryptographically verified by AirGap Vault
- **Restricted environment support** - Includes automatic TextEncoder/TextDecoder polyfill for compatibility
- **Library compatibility** - All dependencies work in AirGap's security-hardened WebView

#### TextEncoder/TextDecoder Polyfill
AirGap Vault's security-hardened WebView environment deliberately excludes certain Web APIs including TextEncoder/TextDecoder. This module includes a minimal, secure polyfill that:

- **Automatically installs** when the module loads in restricted environments
- **Provides UTF-8 encoding/decoding** required by Cardano transaction libraries
- **Zero configuration** - works transparently with existing code
- **Security focused** - minimal implementation, no external dependencies
- **2KB footprint** - negligible impact on module size

## 🧪 Testing

The module includes comprehensive test coverage with full AirGap compatibility validation:

### Test Suites
```bash
npm test                     # All tests (43 AirGap + 244 unit)
npm run test:airgap         # 43 AirGap compliance tests
npm run test:unit           # 244 unit tests
npm run test:coverage       # Generate coverage report
```

### Test Categories
- **AirGap Protocol Compliance** - Standard module interface validation
- **Cryptographic Operations** - Ed25519 signatures, BIP39 mnemonics, key derivation
- **Transaction Lifecycle** - Building, signing, broadcasting, detail extraction
- **Address Generation** - CIP-1852 derivation paths, format validation
- **Network Integration** - Multi-provider data services with failover
- **Error Handling** - Edge cases, malformed data, insufficient balance scenarios

### Testing Environment
- **Automated Testing** - Complete CI/CD pipeline with Jest
- **Manual Testing** - Real Android devices required for AirGap Vault integration
- **Security Testing** - Hardware-backed cryptographic operations validation

## 📚 Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - Technical implementation details and AirGap constraints
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and library compatibility guide

## 📄 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

1. Use `nix develop` for consistent development environment
2. Run `npm test` to ensure all tests pass
3. Follow TypeScript strict mode conventions
4. Test module import on real Android device with AirGap Vault

---

**Production-ready Cardano module for AirGap Vault with full compatibility and comprehensive testing.**