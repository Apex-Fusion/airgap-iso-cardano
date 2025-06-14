# AirGap Cardano Module

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Secure Cardano (ADA) cryptocurrency support for AirGap ecosystem.**

## Features

- ✅ **Offline transaction signing** for air-gapped security
- ✅ **Address generation** (Enterprise, Base, Reward)
- ✅ **UTXO management** and fee estimation
- ✅ **Staking and delegation** support
- ✅ **Native tokens and NFTs**
- ✅ **Hardware wallet integration** (Ledger)
- ✅ **Comprehensive testing** (unit, integration, security)

## Quick Start

### Install from GitHub Packages

```bash
npm install @apex-fusion/cardano
```

### Basic Usage

```typescript
import { CardanoModule } from '@apex-fusion/cardano'

const cardanoModule = new CardanoModule()
const protocol = await cardanoModule.createOfflineProtocol('ada')

// Generate address
const address = await protocol.getAddressFromPublicKey(publicKey)

// Sign transaction (offline)
const signedTx = await protocol.signWithPrivateKey(privateKey, transaction)
```

## Development

### Setup

```bash
git clone https://github.com/Apex-Fusion/airgap-iso-cardano.git
cd airgap-iso-cardano

# Using Nix (recommended)
nix develop

# Or using npm
npm install
```

### Commands

```bash
npm test                           # Run tests
npm run lint && npm run typecheck  # Quality checks
npm run build                      # Build TypeScript
npm run build:airgap              # Generate AirGap bundle
```

### Publish NPM Package

```bash
export GITHUB_TOKEN=your_github_token
npm run publish-cardano-package   # Build, test, and publish
```

This automated workflow:
1. Generates npm package structure
2. Runs lint, typecheck, and tests on converted code
3. Builds TypeScript and publishes to GitHub Packages
4. Cleans up artifacts

## Integration

### AirGap Wallet

```typescript
import { CardanoModule } from '@apex-fusion/cardano'

this.modulesService.init([
  new BitcoinModule(),
  new CardanoModule(),  // Add Cardano support
  new EthereumModule(),
])
```

### AirGap Vault

```bash
npm run build:airgap  # Generates build/airgap-iso-cardano.zip
# Import this file into AirGap Vault
```

## Architecture

```
src/
├── protocol/       # Core Cardano protocol implementations
├── crypto/         # Cryptographic operations  
├── transaction/    # Transaction building and signing
├── utils/          # Utilities and polyfills
├── types/          # TypeScript definitions
└── serializer/     # AirGap serialization support
```

## License

MIT License - see [LICENSE](LICENSE) for details.