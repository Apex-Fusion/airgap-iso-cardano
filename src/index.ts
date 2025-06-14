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
import { CardanoCollectiblesExplorer } from "./protocol/cardano-collectibles-explorer";
import { Logger } from "./utils";

// Define Cardano Protocol Networks following Tezos pattern
export interface CardanoProtocolNetwork extends ProtocolNetwork {
  indexerApi?: string;
  indexerType?: string;
}

export const CARDANO_MAINNET_PROTOCOL_NETWORK: CardanoProtocolNetwork = {
  name: "Mainnet",
  type: "mainnet",
  rpcUrl: "https://cardano-mainnet.blockfrost.io/api/v0",
  blockExplorerUrl: "https://cardanoscan.io",
  indexerApi: "https://api.koios.rest/api/v1",
  indexerType: "koios",
};

export const CARDANO_TESTNET_PROTOCOL_NETWORK: CardanoProtocolNetwork = {
  name: "Testnet", 
  type: "testnet",
  rpcUrl: "https://cardano-testnet.blockfrost.io/api/v0",
  blockExplorerUrl: "https://testnet.cardanoscan.io",
  indexerApi: "https://api.testnet.koios.rest/api/v1",
  indexerType: "koios",
};

// Protocol identifier constant
const CARDANO_PROTOCOL_IDENTIFIER = "ada";

export class CardanoModule implements AirGapModule<{ ProtocolNetwork: CardanoProtocolNetwork }> {
  private readonly networkRegistries: Record<string, ModuleNetworkRegistry<CardanoProtocolNetwork>>;
  public readonly supportedProtocols: Record<string, ProtocolConfiguration>;

  constructor() {
    // Create network registry with mainnet only (hide network switching UI)
    const cardanoNetworkRegistry: ModuleNetworkRegistry<CardanoProtocolNetwork> = new ModuleNetworkRegistry({
      supportedNetworks: [CARDANO_MAINNET_PROTOCOL_NETWORK]
    });

    this.networkRegistries = {
      [CARDANO_PROTOCOL_IDENTIFIER]: cardanoNetworkRegistry
    };
    
    // Use createSupportedProtocols like working modules
    this.supportedProtocols = createSupportedProtocols(this.networkRegistries);
  }

  async createOfflineProtocol(
    identifier: string,
    networkOrId?: CardanoProtocolNetwork | string
  ): Promise<AirGapOfflineProtocol | undefined> {
    if (identifier !== CARDANO_PROTOCOL_IDENTIFIER) return undefined;
    
    // Follow Tezos pattern for network handling
    const network: CardanoProtocolNetwork | undefined =
      typeof networkOrId === 'object' 
        ? networkOrId 
        : this.networkRegistries[identifier]?.findNetwork(networkOrId);
    
    // Default to mainnet if no network specified (production standard)
    const finalNetwork = network || CARDANO_MAINNET_PROTOCOL_NETWORK;
    
    const networkType = finalNetwork.type === 'testnet' ? 'testnet' : 'mainnet';
    return new CardanoProtocol({ network: networkType });
  }

  async createOnlineProtocol(
    identifier: string,
    networkOrId?: CardanoProtocolNetwork | string,
  ): Promise<AirGapOnlineProtocol | undefined> {
    if (identifier !== CARDANO_PROTOCOL_IDENTIFIER) return undefined;
    
    // Follow Tezos pattern for network handling  
    const network: CardanoProtocolNetwork | undefined =
      typeof networkOrId === 'object' 
        ? networkOrId 
        : this.networkRegistries[identifier]?.findNetwork(networkOrId);
    
    // Default to mainnet if no network specified (production standard)
    const finalNetwork = network || CARDANO_MAINNET_PROTOCOL_NETWORK;

    const networkType = finalNetwork.type === 'testnet' ? 'testnet' : 'mainnet';
    // Use enhanced protocol for online functionality with staking and assets
    return new EnhancedCardanoProtocol({ network: networkType });
  }

  async createBlockExplorer(identifier: string, networkOrId?: CardanoProtocolNetwork | string): Promise<AirGapBlockExplorer | undefined> {
    if (identifier !== CARDANO_PROTOCOL_IDENTIFIER) return undefined;
    
    const network: CardanoProtocolNetwork | undefined =
      typeof networkOrId === 'object' ? networkOrId : this.networkRegistries[identifier]?.findNetwork(networkOrId);
    
    const blockExplorerUrl = network?.blockExplorerUrl || CARDANO_MAINNET_PROTOCOL_NETWORK.blockExplorerUrl;
    
    return new CardanoScanBlockExplorer(blockExplorerUrl);
  }

  async createV3SerializerCompanion(): Promise<AirGapV3SerializerCompanion> {
    return new CardanoV3SerializerCompanion();
  }

  // =============================================================================
  // Token and Collectibles Support Methods
  // =============================================================================

  /**
   * Get supported native token sub-protocols
   * This method helps AirGap detect token support capabilities
   */
  public getSupportedTokens(): string[] {
    // Return list of well-known Cardano native tokens
    // AirGap can use this to populate token selection UI
    return [
      // Popular Cardano native tokens - can be expanded
      'hosky', // HOSKY token
      'sundae', // SundaeSwap token
      'min', // Minswap token
      'ada-handle', // ADA Handle NFTs
      'jpg-store', // JPG Store collectibles
    ];
  }

  /**
   * Create a native token protocol instance
   * Used by AirGap to create token sub-protocols dynamically
   */
  public async createTokenProtocol(
    tokenIdentifier: string,
    networkOrId?: CardanoProtocolNetwork | string
  ): Promise<any | undefined> {
    // This would be called by AirGap when user adds a custom token
    // For now, return undefined - full implementation would create CardanoNativeTokenProtocol
    
    const network: CardanoProtocolNetwork | undefined =
      typeof networkOrId === 'object' 
        ? networkOrId 
        : this.networkRegistries[CARDANO_PROTOCOL_IDENTIFIER]?.findNetwork(networkOrId);
    
    const finalNetwork = network || CARDANO_MAINNET_PROTOCOL_NETWORK;
    // This would need token registry or user input to get policyId/assetName
    // For demonstration, return undefined
    Logger.info(`Token protocol creation requested for: ${tokenIdentifier}, network: ${finalNetwork.type}`);
    return undefined;
  }

  /**
   * Check if the protocol supports tokens
   * Used by AirGap to determine if "Add Tokens" button should be shown
   */
  public supportsTokens(): boolean {
    return true; // Cardano supports native tokens
  }

  /**
   * Check if the protocol supports collectibles/NFTs
   * Used by AirGap to determine if "Collectibles" button should be shown
   */
  public supportsCollectibles(): boolean {
    return true; // Cardano supports NFTs via native tokens
  }

  /**
   * Create collectibles explorer instance
   * Used by AirGap's CollectiblesService
   */
  public createCollectiblesExplorer(
    networkOrId?: CardanoProtocolNetwork | string
  ): any {
    const network: CardanoProtocolNetwork | undefined =
      typeof networkOrId === 'object' 
        ? networkOrId 
        : this.networkRegistries[CARDANO_PROTOCOL_IDENTIFIER]?.findNetwork(networkOrId);
    
    const finalNetwork = network || CARDANO_MAINNET_PROTOCOL_NETWORK;
    const networkType = finalNetwork.type === 'testnet' ? 'testnet' : 'mainnet';

    return CardanoCollectiblesExplorer.create({ network: networkType });
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

// Native token and collectibles support
export {
  CardanoNativeTokenProtocol,
  CardanoNativeTokenMetadata,
  CardanoNativeTokenProtocolOptions
} from "./protocol/cardano-native-token-protocol";

export {
  CardanoCollectiblesExplorer,
  CardanoCollectible,
  CardanoCollectibleDetails,
  cardanoCollectibleExplorer
} from "./protocol/cardano-collectibles-explorer";

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
// Analytics and governance extensions removed for AirGap vault focus
// These features are better suited for online wallets and web applications
export {
  DelegateeDetails,
  DelegatorDetails,
  DelegatorAction,
  DelegatorReward,
  CardanoDelegationActionType,
} from "./protocol/cardano-delegation-protocol";
