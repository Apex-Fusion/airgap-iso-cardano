import { AirGapModule } from '@airgap/module-kit'
import { CardanoModule } from './module/CardanoModule'

export * from './index'

export function create(): AirGapModule {
  return new CardanoModule()
}