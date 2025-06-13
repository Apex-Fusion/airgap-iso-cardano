/**
 * Enhanced Cardano Protocol with Core Extensions
 * Integrates staking and asset management functionality for AirGap vault
 */

import { PublicKey } from "@airgap/module-kit";
import { CardanoDelegationProtocol } from "./cardano-delegation-protocol";
import { CardanoStakingExtensions } from "./staking-extensions";
import { CardanoAssetExtensions } from "./asset-extensions";
import { CardanoDataService } from "../data/cardano-data-service";
import { CardanoProtocolOptions } from "../types";

/**
 * Enhanced Cardano Protocol with core functionality for AirGap vault
 * Extends the base protocol with staking and asset management
 */
export class EnhancedCardanoProtocol extends CardanoDelegationProtocol {
  private readonly assetExtensions: CardanoAssetExtensions;

  constructor(options: CardanoProtocolOptions = { network: "mainnet" }) {
    super(options);
    
    // Get the data service from the parent protocol
    const dataService = this.getDataService();
    
    // Initialize core extension modules (staking is handled by parent)
    this.assetExtensions = new CardanoAssetExtensions(dataService);
  }

  /**
   * Get access to the internal data service for extensions
   */
  protected getDataService(): CardanoDataService {
    // Access the private dataService from the parent class
    return (this as any).dataService;
  }

  // =================== STAKING EXTENSIONS ===================

  /**
   * Get all active stake pools with comprehensive information
   */
  async getStakePools() {
    return this.getStakingExtensions().getStakePools();
  }

  /**
   * Get detailed information about a specific stake pool
   */
  async getStakePoolDetails(poolId: string) {
    return this.getStakingExtensions().getStakePoolDetails(poolId);
  }

  /**
   * Get current delegation status for a public key
   */
  async getDelegationInfo(publicKey: PublicKey) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.getStakingExtensions().getDelegationInfo(address);
  }

  /**
   * Get staking rewards history for a public key
   */
  async getRewardsHistory(publicKey: PublicKey, limit: number = 50) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.getStakingExtensions().getRewardsHistory(address, limit);
  }

  /**
   * Get staking activity history (registrations, delegations, withdrawals)
   */
  async getStakingActivity(publicKey: PublicKey, limit: number = 50) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.getStakingExtensions().getStakingActivity(address, limit);
  }

  /**
   * Get top performing stake pools by various metrics
   */
  async getTopStakePools(metric: 'roa' | 'blocks' | 'stake' = 'roa', limit: number = 20) {
    return this.getStakingExtensions().getTopStakePools(metric, limit);
  }

  /**
   * Calculate estimated staking rewards for an amount
   */
  calculateStakingRewards(amount: string, poolRoa: number) {
    return this.getStakingExtensions().calculateStakingRewards(amount, poolRoa);
  }


  /**
   * Get detailed current epoch information
   */
  async getCurrentEpochInfo() {
    return this.getStakingExtensions().getCurrentEpoch();
  }

  /**
   * Get staking extensions from parent delegation protocol
   */
  private getStakingExtensions(): CardanoStakingExtensions {
    return (this as any).stakingExtensions;
  }

  // =================== ASSET EXTENSIONS ===================

  /**
   * Get comprehensive portfolio overview including all assets
   */
  async getPortfolio(publicKey: PublicKey) {
    return this.assetExtensions.getPortfolio(publicKey);
  }

  /**
   * Get detailed token balances with metadata for a public key
   */
  async getTokenBalances(publicKey: PublicKey) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.assetExtensions.getTokenBalances(address);
  }

  /**
   * Get comprehensive asset metadata from multiple sources
   */
  async getAssetMetadata(policyId: string, assetName: string) {
    return this.assetExtensions.getAssetMetadata(policyId, assetName);
  }

  /**
   * Get asset price data from market APIs
   */
  async getAssetPrice(fingerprint: string) {
    return this.assetExtensions.getAssetPrice(fingerprint);
  }


  /**
   * Get asset transfer history for a public key
   */
  async getAssetTransferHistory(publicKey: PublicKey, limit: number = 50) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.assetExtensions.getAssetTransferHistory(address, limit);
  }

  /**
   * Search for assets by name or policy ID
   */
  async searchAssets(query: string, limit: number = 20) {
    return this.assetExtensions.searchAssets(query, limit);
  }

  /**
   * Get NFT collection information
   */
  async getNFTCollection(policyId: string) {
    return this.assetExtensions.getNFTCollection(policyId);
  }
}
