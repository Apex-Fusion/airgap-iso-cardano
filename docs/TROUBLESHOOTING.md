# Troubleshooting Guide

## Common Issues

### Module Loading Issues

#### Module Hangs During Loading
**Problem**: Module hangs for 60+ seconds, then times out  
**Root Cause**: Modern libraries using TextDecoder/TextEncoder not available in AirGap WebView  
**Solution**: The module includes an automatic polyfill that resolves this issue

#### Invalid Module Format
**Problem**: "Invalid module format" error when importing  
**Solutions**:
- Ensure files are in `module/` subdirectory within ZIP
- Verify module signing with valid keypair
- Check manifest.json is properly generated

### Development Environment Issues

#### Build Failures
**Problem**: TypeScript compilation errors  
**Solutions**:
```bash
# Clean build
npm run clean
npm install
npm run build

# Check TypeScript configuration
npx tsc --noEmit
```

#### Test Failures
**Problem**: Tests failing in development environment  
**Solutions**:
```bash
# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:airgap      # AirGap compatibility tests

# Clear Jest cache
npx jest --clearCache
```

### AirGap Integration Issues

#### Module Not Recognized
**Problem**: AirGap Vault doesn't recognize the module  
**Checklist**:
- [ ] ZIP contains `module/` directory
- [ ] `manifest.json` is present and valid
- [ ] Module is cryptographically signed
- [ ] File permissions allow reading

#### Runtime Errors
**Problem**: Module loads but crashes during operation  
**Debug Steps**:
1. Check Android device logs: `adb logcat | grep AirGap`
2. Verify all dependencies are AirGap-compatible
3. Test with minimal transaction first
4. Ensure secure hardware is available

## Library Compatibility

### AirGap Environment Constraints

AirGap Vault operates in a restricted WebView environment with specific library requirements:

#### Compatible Libraries (✅ Working)
```json
{
  "cryptography": {
    "@stablelib/blake2b": "^1.0.1",
    "@stablelib/ed25519": "^1.0.3",
    "@stablelib/sha256": "^1.0.1",
    "status": "✅ Proven compatible"
  },
  "cardano_specific": {
    "bip39": "^3.1.0",
    "@stricahq/bip32ed25519": "^2.1.1",
    "@stricahq/typhonjs": "^3.0.0",
    "cbor-js": "^0.1.0",
    "status": "✅ Working with polyfill"
  },
  "airgap_framework": {
    "@airgap/module-kit": "^0.13.21",
    "@airgap/serializer": "^0.13.21",
    "@airgap/coinlib-core": "^0.13.40",
    "status": "✅ Official support"
  }
}
```

#### Incompatible Libraries (❌ Avoid)
```json
{
  "modern_crypto": {
    "@noble/hashes": "1.3.3+",
    "@noble/ed25519": "2.0.0+",
    "@scure/bip39": "1.2.2+",
    "@scure/bip32": "1.3.1+",
    "reason": "❌ Requires TextDecoder/TextEncoder"
  },
  "wasm_libraries": {
    "@dcspark/cardano-multiplatform-lib-browser": "any",
    "@emurgo/cardano-serialization-lib-browser": "any",
    "reason": "❌ Modern WASM features not available"
  }
}
```

### Compatibility Matrix by Coin

Analysis of working AirGap modules reveals universal patterns:

| Coin | Working Libraries | Library Vintage | Status |
|------|------------------|-----------------|---------|
| **Bitcoin** | `bitcoinjs-lib@5.2.0` | 2020 | ✅ Works |
| **Ethereum** | `@ethereumjs/tx@3.4.0` | 2021 | ✅ Works |
| **Tezos** | `@stablelib/*@1.0.x` | 2020 | ✅ Works |
| **Substrate** | `@polkadot/util@2.0.1` | 2020 | ✅ Works |
| **Cardano** | `@stablelib/* + polyfill` | 2020 + polyfill | ✅ Works |

#### Key Pattern
- ✅ **100% of working modules use 2019-2021 libraries**
- ❌ **ZERO working modules use @noble/* or @scure/* libraries**
- ❌ **ZERO working modules use modern TextDecoder-dependent libraries**

## Testing Issues

### Hardware Requirements

#### Secure Hardware Missing
**Problem**: "Secure hardware not available" error  
**Requirements**:
- Hardware Security Module (HSM) features
- Secure Enclave/TEE for key isolation
- Real Android devices with secure hardware
- Cannot be emulated

#### Manual Testing Required
**Limitation**: Automated testing cannot fully validate AirGap integration  
**Approach**:
```bash
# Build and deploy to real device
npm run bundle:airgap:zip
adb push build/airgap-iso-cardano.zip /sdcard/Download/

# Manual steps:
# 1. Open AirGap Vault on device
# 2. Settings → Isolated Modules → Import Module
# 3. Select the ZIP file
# 4. Test key generation and transaction signing
```

### Performance Issues

#### Slow Module Loading
**Problem**: Module takes long time to initialize  
**Solutions**:
- Ensure device has sufficient memory
- Close other applications
- Use newer Android device with better performance

#### Transaction Building Timeout
**Problem**: Transaction preparation times out  
**Debug**:
```bash
# Check network connectivity
adb shell ping 8.8.8.8

# Monitor memory usage
adb shell dumpsys meminfo it.airgap.vault

# Check for large UTXOs
# Module handles UTXO selection automatically
```

## Build System Issues

### Nix Environment

#### Nix Setup Problems
```bash
# Install Nix
curl -L https://nixos.org/nix/install | sh

# Enter development environment
nix develop

# If flake issues:
nix develop --extra-experimental-features nix-command --extra-experimental-features flakes
```

#### Dependencies Not Found
```bash
# Rebuild environment
nix develop --rebuild

# Clear Nix cache if needed
nix-collect-garbage
```

### Module Signing

#### Missing Keypair
**Problem**: Module signing fails with missing keys  
**Solution**:
```bash
# Generate signing keypair
npm run generate-keypair

# Verify keypair.json exists
ls -la keypair.json
```

#### Invalid Signature
**Problem**: AirGap rejects module signature  
**Debug**:
```bash
# Re-sign module
npm run sign-module

# Verify signature
node scripts/build/verify-signature.js
```

## Network Integration Issues

### Data Provider Failures

#### All Providers Offline
**Problem**: No network data available  
**Fallback**: Module operates in offline mode with cached/default values

#### API Rate Limiting
**Problem**: Too many requests to public APIs  
**Solutions**:
- Use multiple providers with automatic failover
- Implement request caching
- Consider Blockfrost API key for higher limits

#### Incorrect Network Data
**Problem**: Wrong protocol parameters or UTXO data  
**Debug**:
```bash
# Test connectivity
npm run test -- --testNamePattern="connectivity"

# Check specific provider
npm run test -- --testNamePattern="blockfrost"
```

## Security Concerns

### Key Management

#### Insecure Key Storage
**Warning**: Never store private keys in development environment  
**Best Practice**: Use test mnemonics only

#### Memory Leaks
**Problem**: Sensitive data not properly cleaned  
**Solution**: Module implements automatic secure cleanup

### Module Integrity

#### Unsigned Modules
**Risk**: Unsigned modules pose security risk  
**Requirement**: All production modules must be cryptographically signed

#### Dependency Vulnerabilities
**Mitigation**: Regular security audits and dependency updates

## Getting Help

### Debug Information

When reporting issues, include:

1. **Environment**:
   ```bash
   node --version
   npm --version
   nix --version  # if using Nix
   ```

2. **Module Information**:
   ```bash
   npm run test:airgap -- --verbose
   ```

3. **Device Information**:
   ```bash
   adb shell getprop ro.build.version.release  # Android version
   adb shell getprop ro.product.model          # Device model
   ```

4. **Error Logs**:
   ```bash
   adb logcat | grep -E "(AirGap|Cardano)"
   ```

### Support Channels

- **Issues**: GitHub repository issues
- **Documentation**: `/docs` directory
- **Test Examples**: `/test/v1` directory
- **Build Scripts**: `/scripts` directory

### Emergency Recovery

#### Module Corrupted
1. Remove corrupted module from AirGap Vault
2. Rebuild from clean environment:
   ```bash
   npm run clean
   npm install
   npm run bundle:airgap:zip
   ```
3. Reinstall module

#### Development Environment Broken
1. Reset to clean state:
   ```bash
   git clean -fdx
   nix develop --rebuild
   npm install
   ```
2. Verify with tests:
   ```bash
   npm test
   ```