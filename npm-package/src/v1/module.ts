import { AirGapModule } from '@airgap/module-kit'
import { CardanoModule } from './index'

export * from './index'

export function create(): AirGapModule {
  return new CardanoModule()
}
