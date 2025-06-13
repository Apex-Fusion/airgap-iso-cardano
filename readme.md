# @airgap/cardano

The `@airgap/cardano` is a Cardano implementation of the ICoinProtocol interface from `@airgap/coinlib-core`.

## Features

- Full Cardano ADA support
- Native token support
- NFT/Collectibles support
- Staking and delegation
- Hardware wallet integration
- Offline transaction signing
- Mainnet and testnet support

## Installation

```bash
npm install @airgap/cardano
```

## Usage

```typescript
import { CardanoModule } from '@airgap/cardano'

const cardanoModule = new CardanoModule()
const protocol = await cardanoModule.createOfflineProtocol('cardano')
```

## Documentation

For more detailed documentation, please visit the [AirGap documentation](https://docs.airgap.it/).

## License

MIT License. See [LICENSE](https://github.com/airgap-it/airgap-coin-lib/blob/master/LICENSE.md) for details.