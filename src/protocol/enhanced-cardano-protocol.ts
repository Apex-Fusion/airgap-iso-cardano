/**
 * Enhanced Cardano Protocol with Advanced Online Extensions
 * Integrates staking, asset management, analytics, and governance functionality
 */

import { PublicKey, UnsignedTransaction } from "@airgap/module-kit";
import { CardanoDelegationProtocol } from "./cardano-delegation-protocol";
import { CardanoStakingExtensions } from "./staking-extensions";
import { CardanoAssetExtensions } from "./asset-extensions";
import { CardanoAnalyticsExtensions } from "./analytics-extensions";
import { CardanoGovernanceExtensions } from "./governance-extensions";
import { CardanoDataService } from "../data/cardano-data-service";
import { CardanoProtocolOptions } from "../types";
import { DelegateeDetails, DelegatorDetails, CardanoDelegationActionType } from "./cardano-delegation-protocol";

/**
 * Enhanced Cardano Protocol with comprehensive online functionality
 * Extends the base protocol with staking, assets, analytics, and governance
 */
export class EnhancedCardanoProtocol extends CardanoDelegationProtocol {
  private readonly assetExtensions: CardanoAssetExtensions;
  private readonly analyticsExtensions: CardanoAnalyticsExtensions;
  private readonly governanceExtensions: CardanoGovernanceExtensions;

  constructor(options: CardanoProtocolOptions = { network: "mainnet" }) {
    super(options);
    
    // Get the data service from the parent protocol
    const dataService = this.getDataService();
    
    // Initialize remaining extension modules (staking is handled by parent)
    this.assetExtensions = new CardanoAssetExtensions(dataService);
    this.analyticsExtensions = new CardanoAnalyticsExtensions(dataService);
    this.governanceExtensions = new CardanoGovernanceExtensions(dataService);
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
   * Get current epoch information
   */
  async getCurrentEpoch() {
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

  // =================== ANALYTICS EXTENSIONS ===================

  /**
   * Get detailed transaction information with full CBOR parsing
   */
  async getDetailedTransaction(txHash: string, publicKey?: PublicKey) {
    const userAddress = publicKey ? await this.getAddressFromPublicKey(publicKey) : undefined;
    return this.analyticsExtensions.getDetailedTransaction(txHash, userAddress);
  }

  /**
   * Get comprehensive transaction statistics for a public key
   */
  async getTransactionStats(publicKey: PublicKey, fromDate?: Date, toDate?: Date) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.analyticsExtensions.getTransactionStats(address, fromDate, toDate);
  }

  /**
   * Detect and parse DeFi protocol interactions
   */
  async getDeFiActivity(publicKey: PublicKey, limit: number = 50) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.analyticsExtensions.getDeFiActivity(address, limit);
  }

  /**
   * Calculate portfolio performance metrics
   */
  async getPortfolioMetrics(publicKey: PublicKey) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.analyticsExtensions.getPortfolioMetrics(address);
  }

  /**
   * Get transaction flow analysis (cash flow patterns)
   */
  async getTransactionFlow(publicKey: PublicKey, period: 'week' | 'month' | 'year' = 'month') {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.analyticsExtensions.getTransactionFlow(address, period);
  }

  // =================== GOVERNANCE EXTENSIONS ===================

  /**
   * Get active governance proposals
   */
  async getGovernanceProposals(category?: string, status?: string) {
    return this.governanceExtensions.getGovernanceProposals(category, status);
  }

  /**
   * Get voting power for a public key
   */
  async getVotingPower(publicKey: PublicKey) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.governanceExtensions.getVotingPower(address);
  }

  /**
   * Create a governance vote transaction
   */
  async createGovernanceVote(
    proposalId: string,
    vote: "yes" | "no" | "abstain",
    voterPublicKey: PublicKey
  ): Promise<UnsignedTransaction> {
    return this.governanceExtensions.createGovernanceVote(proposalId, vote, voterPublicKey);
  }

  /**
   * Get voting history for a public key
   */
  async getVotingHistory(publicKey: PublicKey) {
    const address = await this.getAddressFromPublicKey(publicKey);
    return this.governanceExtensions.getVotingHistory(address);
  }

  /**
   * Get Project Catalyst proposals for current fund
   */
  async getCatalystProposals(fund?: number, category?: string) {
    return this.governanceExtensions.getCatalystProposals(fund, category);
  }

  /**
   * Register for Catalyst voting
   */
  async registerForCatalystVoting(
    publicKey: PublicKey,
    votingPowerThreshold: string = "500000000"
  ): Promise<UnsignedTransaction> {
    return this.governanceExtensions.registerForCatalystVoting(publicKey, votingPowerThreshold);
  }

  /**
   * Create a native script for multi-signature wallet
   */
  createMultiSigScript(
    publicKeys: string[],
    requiredSignatures: number,
    timelock?: { validAfter?: Date; validBefore?: Date }
  ) {
    return this.governanceExtensions.createMultiSigScript(publicKeys, requiredSignatures, timelock);
  }

  /**
   * Create multi-signature wallet
   */
  async createMultiSigWallet(
    publicKeys: string[],
    requiredSignatures: number,
    timelock?: { validAfter?: Date; validBefore?: Date }
  ) {
    return this.governanceExtensions.createMultiSigWallet(publicKeys, requiredSignatures, timelock);
  }

  /**
   * Create a transaction that requires multiple signatures
   */
  async createMultiSigTransaction(
    scriptHash: string,
    outputs: Array<{ address: string; amount: string; assets?: any[] }>,
    metadata?: any
  ) {
    return this.governanceExtensions.createMultiSigTransaction(scriptHash, outputs, metadata);
  }

  /**
   * Sign a pending multi-signature transaction
   */
  async signMultiSigTransaction(
    pendingTx: any,
    signature: string,
    signerPublicKey: string
  ) {
    return this.governanceExtensions.signMultiSigTransaction(pendingTx, signature, signerPublicKey);
  }

  /**
   * Get multi-signature wallet details
   */
  async getMultiSigWallet(scriptHash: string) {
    return this.governanceExtensions.getMultiSigWallet(scriptHash);
  }

  // =================== DELEGATION INTERFACE ===================

  /**
   * Get default stake pool (AirGap delegation interface)
   */
  async getDefaultDelegatee(): Promise<DelegateeDetails> {
    return super.getDefaultDelegatee();
  }

  /**
   * Get current delegation for a public key (AirGap delegation interface)
   */
  async getCurrentDelegateesForPublicKey(publicKey: PublicKey): Promise<string[]> {
    return super.getCurrentDelegateesForPublicKey(publicKey);
  }

  /**
   * Get stake pool details (AirGap delegation interface)
   */
  async getDelegateeDetails(poolId: string): Promise<DelegateeDetails> {
    return super.getDelegateeDetails(poolId);
  }

  /**
   * Check if delegating (AirGap delegation interface)
   */
  async isPublicKeyDelegating(publicKey: PublicKey): Promise<boolean> {
    return super.isPublicKeyDelegating(publicKey);
  }

  /**
   * Get delegator details (AirGap delegation interface)
   */
  async getDelegatorDetailsFromPublicKey(publicKey: PublicKey): Promise<DelegatorDetails> {
    return super.getDelegatorDetailsFromPublicKey(publicKey);
  }

  /**
   * Prepare delegation transaction (AirGap delegation interface)
   */
  async prepareDelegatorActionFromPublicKey(
    publicKey: PublicKey,
    type: CardanoDelegationActionType,
    data?: any
  ): Promise<UnsignedTransaction> {
    return super.prepareDelegatorActionFromPublicKey(publicKey, type, data);
  }

  // =================== ENHANCED FUNCTIONALITY ===================

  /**
   * Get comprehensive account summary including all protocol features
   */
  async getAccountSummary(publicKey: PublicKey) {
    const [
      balance,
      portfolio,
      delegationInfo,
      stakingActivity,
      transactionStats,
      votingPower
    ] = await Promise.allSettled([
      this.getBalanceOfPublicKey(publicKey),
      this.getPortfolio(publicKey),
      this.getDelegationInfo(publicKey),
      this.getStakingActivity(publicKey, 10),
      this.getTransactionStats(publicKey),
      this.getVotingPower(publicKey)
    ]);

    return {
      balance: balance.status === 'fulfilled' ? balance.value : null,
      portfolio: portfolio.status === 'fulfilled' ? portfolio.value : null,
      delegation: delegationInfo.status === 'fulfilled' ? delegationInfo.value : null,
      recentStakingActivity: stakingActivity.status === 'fulfilled' ? stakingActivity.value : [],
      transactionStats: transactionStats.status === 'fulfilled' ? transactionStats.value : null,
      votingPower: votingPower.status === 'fulfilled' ? votingPower.value : null,
      lastUpdated: new Date()
    };
  }

  /**
   * Check all online service connectivity
   */
  async getServiceStatus() {
    const dataConnectivity = await this.getDataService().testConnectivity();
    const currentEpoch = await this.getCurrentEpoch();
    
    return {
      dataProviders: dataConnectivity,
      networkConnectivity: Object.values(dataConnectivity).some(Boolean),
      currentEpoch: currentEpoch?.epoch || null,
      stakingActive: currentEpoch !== null,
      governanceActive: false, // CIP-1694 not yet implemented
      timestamp: new Date()
    };
  }
}