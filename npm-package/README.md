# @apex-fusion/cardano

Cardano implementation for AirGap ecosystem.

Generated from airgap-iso-cardano.

## Usage

```typescript
import { CardanoModule } from '@apex-fusion/cardano'

const cardanoModule = new CardanoModule()
```

## Icon Assets

This package includes Cardano icon assets in the `assets/` and `dist/assets/` directories:

- `ada.svg` / `ada.png` - ADA symbol icons
- `cardano.svg` / `cardano.png` - Cardano protocol icons

### Using icons in your app

Copy the icons to your app's assets folder:

```bash
# From your app's root directory
cp node_modules/@apex-fusion/cardano/assets/*.svg src/assets/symbols/
cp node_modules/@apex-fusion/cardano/assets/*.png src/assets/symbols/
```

Or add a postinstall script to your package.json:

```json
{
  "scripts": {
    "postinstall": "cp node_modules/@apex-fusion/cardano/assets/* src/assets/symbols/ 2>/dev/null || true"
  }
}
```
