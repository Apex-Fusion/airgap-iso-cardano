// Install TextEncoder/TextDecoder polyfill for AirGap compatibility
// This must be done before importing TyphonJS dependencies
import { installTextEncoderPolyfill } from "./utils/text-encoder-polyfill";
installTextEncoderPolyfill();

import {
  AirGapModule,
  ProtocolConfiguration,
  AirGapOfflineProtocol,
  AirGapOnlineProtocol,
  AirGapV3SerializerCompanion,
  AirGapBlockExplorer,
  ModuleNetworkRegistry,
  createSupportedProtocols,
  ProtocolNetwork,
} from "@airgap/module-kit";

import { CardanoProtocol } from "./protocol/cardano-protocol";
import { EnhancedCardanoProtocol } from "./protocol/enhanced-cardano-protocol";
import { CardanoDelegationProtocol } from "./protocol/cardano-delegation-protocol";
import { CardanoV3SerializerCompanion } from "./serializer/cardano-v3-serializer";
import { CardanoProtocolOptions } from "./types/cardano";
import { CardanoScanBlockExplorer } from "./block-explorer/CardanoScanBlockExplorer";

// Define Cardano Protocol Networks
const CARDANO_MAINNET_PROTOCOL_NETWORK: ProtocolNetwork = {
  name: "Cardano Mainnet",
  type: "mainnet",
  rpcUrl: "https://cardano-mainnet.blockfrost.io/api/v0",
  blockExplorerUrl: "https://cardanoscan.io",
};

const CARDANO_TESTNET_PROTOCOL_NETWORK: ProtocolNetwork = {
  name: "Cardano Testnet", 
  type: "testnet",
  rpcUrl: "https://cardano-testnet.blockfrost.io/api/v0",
  blockExplorerUrl: "https://testnet.cardanoscan.io",
};

// Protocol identifier constant
const CARDANO_PROTOCOL_IDENTIFIER = "cardano";

export class CardanoModule implements AirGapModule {
  private readonly networkRegistries: Record<string, ModuleNetworkRegistry>;
  public readonly supportedProtocols: Record<string, ProtocolConfiguration>;
  private readonly options: CardanoProtocolOptions;

  constructor(options: CardanoProtocolOptions = { network: "mainnet" }) {
    this.options = options;
    
    // Create network registry following airgap-coin-lib pattern
    const networkRegistry: ModuleNetworkRegistry = new ModuleNetworkRegistry({
      supportedNetworks: [CARDANO_MAINNET_PROTOCOL_NETWORK, CARDANO_TESTNET_PROTOCOL_NETWORK]
    });

    this.networkRegistries = {
      [CARDANO_PROTOCOL_IDENTIFIER]: networkRegistry
    };
    
    // Use createSupportedProtocols like working modules
    this.supportedProtocols = createSupportedProtocols(this.networkRegistries);
  }

  async createOfflineProtocol(
    identifier: string,
  ): Promise<AirGapOfflineProtocol | undefined> {
    if (identifier !== CARDANO_PROTOCOL_IDENTIFIER) return undefined;
    return new CardanoProtocol(this.options);
  }

  async createOnlineProtocol(
    identifier: string,
    networkOrId?: string,
  ): Promise<AirGapOnlineProtocol | undefined> {
    if (identifier !== CARDANO_PROTOCOL_IDENTIFIER) return undefined;
    
    // Ensure WASM is initialized before creating protocol
    const network = networkOrId === "testnet" ? "testnet" : "mainnet";
    // Use enhanced protocol for online functionality with staking, assets, analytics, and governance
    return new EnhancedCardanoProtocol({ ...this.options, network });
  }

  async createBlockExplorer(identifier: string, networkOrId?: string): Promise<AirGapBlockExplorer | undefined> {
    if (identifier !== CARDANO_PROTOCOL_IDENTIFIER) return undefined;
    
    const network = networkOrId === "testnet" ? "testnet" : "mainnet";
    const blockExplorerUrl = network === "testnet" 
      ? CARDANO_TESTNET_PROTOCOL_NETWORK.blockExplorerUrl
      : CARDANO_MAINNET_PROTOCOL_NETWORK.blockExplorerUrl;
    
    return new CardanoScanBlockExplorer(blockExplorerUrl);
  }

  async createV3SerializerCompanion(): Promise<AirGapV3SerializerCompanion> {
    return new CardanoV3SerializerCompanion();
  }
}

// Export for module kit compatibility
export default CardanoModule;

/**
 * Entry point for AirGap module system.
 * This function is called by AirGap to create an instance of the Cardano module.
 */
export function create() {
  return new CardanoModule();
}

export {
  CardanoProtocol,
  EnhancedCardanoProtocol,
  CardanoDelegationProtocol,
  CardanoV3SerializerCompanion,
  CardanoProtocolOptions,
  CardanoScanBlockExplorer,
};

// Core types and domain models
export * from "./types";

// Crypto operations
export * from "./crypto";

// Transaction operations
export * from "./transaction";

// Data services
export * from "./data";

// Utilities
export * from "./utils/address";
export * from "./utils/security";

// Result and validation utilities (specific exports to avoid conflicts)
export {
  Result,
  ResultUtils,
  AsyncResult,
  ok,
  error,
  tryFn,
  tryAsync,
} from "./utils/result";
export {
  Validators,
  CardanoValidationError,
  ValidationSchema,
  ValidationError,
} from "./utils/validation";

// Online protocol extensions (explicit exports to avoid conflicts)
export {
  CardanoStakingExtensions,
  StakePool,
  DelegationInfo,
  RewardHistory,
  StakingActivity,
} from "./protocol/staking-extensions";
export {
  CardanoAssetExtensions,
  AssetMetadata,
  TokenBalance,
  NFTMetadata,
  AssetTransfer,
  Portfolio,
  AssetPrice,
} from "./protocol/asset-extensions";
export {
  CardanoAnalyticsExtensions,
  DetailedTransaction,
  TransactionStats,
  DeFiActivity,
  PortfolioMetrics,
} from "./protocol/analytics-extensions";
export {
  CardanoGovernanceExtensions,
  GovernanceProposal,
  VotingPower,
  Vote,
  CatalystProposal,
  MultiSigWallet,
  PendingMultiSigTransaction,
} from "./protocol/governance-extensions";
export {
  DelegateeDetails,
  DelegatorDetails,
  DelegatorAction,
  DelegatorReward,
  CardanoDelegationActionType,
} from "./protocol/cardano-delegation-protocol";
