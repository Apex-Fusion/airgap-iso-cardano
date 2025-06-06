/**
 * Cardano Native Token Protocol - Sub-Protocol Implementation
 * Implements ICoinSubProtocol for native token support in AirGap Wallet
 * 
 * NOTE: This is a framework implementation showing how to structure
 * native token support. Full integration requires AirGap-specific interfaces.
 */

import { Logger } from "../utils";
import { CardanoProtocolOptions } from "../types/cardano";
import { AssetMetadata } from "./asset-extensions";

// Interfaces that will be available when integrated with AirGap Wallet
export interface ICoinSubProtocol {
  isSubProtocol: boolean;
  subProtocolType: 'token' | 'account';
  contractAddress?: string;
}

export interface CardanoNativeTokenMetadata {
  policyId: string;
  assetName: string;
  assetNameHex: string;
  fingerprint: string;
  name?: string;
  symbol?: string;
  description?: string;
  decimals?: number;
  totalSupply?: string;
  logo?: string;
  ticker?: string;
  verified?: boolean;
}

export interface CardanoNativeTokenProtocolOptions extends CardanoProtocolOptions {
  policyId: string;
  assetName: string;
  assetNameHex: string;
  metadata?: CardanoNativeTokenMetadata;
}

/**
 * Cardano Native Token Protocol implementing ICoinSubProtocol
 * This is a reference implementation showing the structure needed for AirGap integration
 */
export class CardanoNativeTokenProtocol implements ICoinSubProtocol {
  public readonly isSubProtocol: boolean = true;
  public readonly subProtocolType = 'token' as const;
  
  protected readonly tokenOptions: CardanoNativeTokenProtocolOptions;
  private _metadata?: CardanoNativeTokenMetadata;

  constructor(options: CardanoNativeTokenProtocolOptions) {
    this.tokenOptions = options;
    this._metadata = options.metadata;
  }

  // =============================================================================
  // Sub-Protocol Interface Implementation
  // =============================================================================

  /**
   * Returns true to indicate this is a sub-protocol
   */
  public async getIsSubProtocol(): Promise<boolean> {
    return true;
  }

  /**
   * Returns the sub-protocol type (always 'token' for native tokens)
   */
  public async getSubProtocolType(): Promise<'token'> {
    return 'token';
  }

  /**
   * Returns the policy ID as the contract address equivalent
   */
  public async getContractAddress(): Promise<string> {
    return this.tokenOptions.policyId;
  }

  /**
   * Returns the main protocol identifier
   */
  public async getMainProtocol(): Promise<string> {
    return 'cardano'; // MainProtocolSymbols.ADA
  }

  // =============================================================================
  // Token-Specific Methods
  // =============================================================================

  /**
   * Get the policy ID for this native token
   */
  public async getPolicyId(): Promise<string> {
    return this.tokenOptions.policyId;
  }

  /**
   * Get the asset name for this native token
   */
  public async getAssetName(): Promise<string> {
    return this.tokenOptions.assetName;
  }

  /**
   * Get the hex-encoded asset name
   */
  public async getAssetNameHex(): Promise<string> {
    return this.tokenOptions.assetNameHex;
  }

  /**
   * Get the asset fingerprint (CIP-14)
   */
  public async getAssetFingerprint(): Promise<string> {
    if (this._metadata) {
      return this._metadata.fingerprint;
    }
    
    // Generate fingerprint if not available
    // This should use CIP-14 algorithm but simplified for now
    const assetId = this.tokenOptions.policyId + this.tokenOptions.assetNameHex;
    return `asset1${assetId.substring(0, 50)}`; // Simplified - use proper CIP-14 implementation
  }

  /**
   * Get token metadata
   */
  public async getTokenMetadata(): Promise<CardanoNativeTokenMetadata | undefined> {
    if (this._metadata) {
      return this._metadata;
    }

    try {
      // In full implementation, this would fetch from CardanoDataService
      Logger.info(`Token metadata requested for ${this.tokenOptions.policyId}.${this.tokenOptions.assetName}`);
      return this._metadata;
    } catch (error) {
      Logger.warn(`Failed to fetch token metadata: ${error}`);
      return undefined;
    }
  }

  // =============================================================================
  // Factory Methods
  // =============================================================================

  /**
   * Create a new CardanoNativeTokenProtocol instance
   */
  public static create(options: CardanoNativeTokenProtocolOptions): CardanoNativeTokenProtocol {
    return new CardanoNativeTokenProtocol(options);
  }

  /**
   * Create token protocol from asset metadata
   */
  public static fromAssetMetadata(
    baseOptions: CardanoProtocolOptions,
    metadata: AssetMetadata
  ): CardanoNativeTokenProtocol {
    const tokenOptions: CardanoNativeTokenProtocolOptions = {
      ...baseOptions,
      policyId: metadata.policyId,
      assetName: metadata.assetName,
      assetNameHex: metadata.assetNameHex,
      metadata: {
        policyId: metadata.policyId,
        assetName: metadata.assetName,
        assetNameHex: metadata.assetNameHex,
        fingerprint: metadata.fingerprint,
        name: metadata.name,
        symbol: metadata.ticker,
        description: metadata.description,
        decimals: metadata.decimals,
        totalSupply: metadata.totalSupply,
        logo: metadata.logo,
        ticker: metadata.ticker,
        verified: metadata.verified
      }
    };

    return new CardanoNativeTokenProtocol(tokenOptions);
  }
}