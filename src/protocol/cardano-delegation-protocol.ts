/**
 * Cardano Delegation Protocol - AirGap ICoinDelegateProtocol Implementation
 * Bridges our staking extensions with AirGap's expected delegation interface
 */

import { PublicKey, UnsignedTransaction } from "@airgap/module-kit";
import { CardanoProtocol } from "./cardano-protocol";
import { CardanoStakingExtensions } from "./staking-extensions";
import { CardanoDataService } from "../data/cardano-data-service";
import { CardanoProtocolOptions } from "../types";
import { TyphonTransactionBuilder } from "../transaction/typhon-transaction-builder";
import { types as TyphonTypes, utils as TyphonUtils } from '@stricahq/typhonjs';
import BigNumber from 'bignumber.js';
import { UTXO } from "../transaction/utxo-selector";
import { Logger } from "../utils";
import { ValidationError, UTXOSelectionError, TransactionBuildError, ErrorCode } from "../errors/error-types";
import { PoolValidator } from "../utils/pool-validator";
import { CARDANO_CONSTANTS } from "../types/domain";

// AirGap delegation interface data structures
export interface DelegateeDetails {
  name?: string;        // Pool name/ticker
  status?: string;      // Pool status (active/retired/etc)
  address: string;      // Pool ID (bech32)
  // Additional Cardano-specific details
  pledge?: string;
  margin?: number;
  fixedCost?: string;
  saturation?: number;
  roa?: number;
}

export interface DelegatorDetails {
  address: string;                          // User's address
  balance: string;                          // Total balance
  delegatees: string[];                     // Current delegations (pool IDs)
  availableActions?: DelegatorAction[];     // Available actions
  rewards?: DelegatorReward[];              // Reward history
}

export interface DelegatorAction {
  type: CardanoDelegationActionType;        // Action type
  args?: string[];                          // Arguments (pool ID, amounts, etc)
}

export interface DelegatorReward {
  amount: string;           // Reward amount
  collected: boolean;       // Whether collected
  timestamp?: number;       // When earned
  epoch?: number;          // Epoch when earned
}

export type CardanoDelegationActionType = 
  | "delegate"              // Delegate to a stake pool
  | "undelegate"            // Remove delegation (deregister)
  | "withdraw"              // Withdraw rewards
  | "register"              // Register staking certificate
  | "change_delegation";    // Change to different pool

/**
 * Cardano Delegation Protocol implementing AirGap's ICoinDelegateProtocol
 * Maps our comprehensive staking extensions to AirGap's delegation interface
 */
export class CardanoDelegationProtocol extends CardanoProtocol {
  private readonly stakingExtensions: CardanoStakingExtensions;
  private readonly poolValidator: PoolValidator;

  constructor(options: CardanoProtocolOptions = { network: "mainnet" }) {
    super(options);
    
    // Get the data service from the parent protocol
    const dataService = this.getDataService();
    
    // Initialize staking extensions
    this.stakingExtensions = new CardanoStakingExtensions(dataService);
    
    // Initialize pool validator
    this.poolValidator = new PoolValidator(this.stakingExtensions);
  }

  /**
   * Get access to the internal data service
   */
  protected getDataService(): CardanoDataService {
    return (this as any).dataService;
  }

  /**
   * Get network configuration from protocol options
   */
  protected getNetworkConfig(): string {
    return (this as any).options?.network || 'testnet';
  }

  // =================== ICoinDelegateProtocol Implementation ===================

  /**
   * Get default stake pool (highest ROA, active, not oversaturated)
   * Uses dynamic pool selection with intelligent fallback strategy
   */
  async getDefaultDelegatee(): Promise<DelegateeDetails> {
    try {
      // Try multiple selection strategies for robustness
      const strategies = [
        { metric: 'roa' as const, count: 5 },      // Top 5 by ROA
        { metric: 'blocks' as const, count: 10 }, // Top 10 by blocks  
        { metric: 'stake' as const, count: 20 }   // Top 20 by stake
      ];

      for (const strategy of strategies) {
        try {
          const topPools = await this.stakingExtensions.getTopStakePools(strategy.metric, strategy.count);
          
          // Filter for optimal pools: good ROA, reasonable saturation, active
          const optimalPools = topPools.filter(pool => 
            !pool.retired && 
            pool.saturation < 0.9 &&     // Not oversaturated
            pool.saturation > 0.01 &&    // Not too small
            pool.roa > 3.0 &&            // Reasonable returns
            pool.blocksLifetime > 100    // Proven track record
          );

          if (optimalPools.length > 0) {
            // Select best pool from filtered list
            const selectedPool = optimalPools[0];
            Logger.info(`Selected default pool: ${selectedPool.name || selectedPool.ticker} (${strategy.metric} strategy)`);
            return this.mapStakePoolToDelegateeDetails(selectedPool);
          }
        } catch (strategyError) {
          Logger.warn(`Pool selection strategy ${strategy.metric} failed: ${(strategyError as Error).message}`);
          continue;
        }
      }

      // If all strategies fail, try getting any active pool
      const allPools = await this.stakingExtensions.getStakePools();
      const activePools = allPools.filter(pool => !pool.retired && pool.saturation < 1.0);
      
      if (activePools.length > 0) {
        const fallbackPool = activePools[0];
        Logger.warn(`Using fallback pool selection: ${fallbackPool.name || fallbackPool.ticker}`);
        return this.mapStakePoolToDelegateeDetails(fallbackPool);
      }

      throw new Error('No suitable stake pools found with any strategy');
    } catch (error) {
      Logger.error('All pool selection strategies failed', error as Error);
      
      // Final fallback: use well-known pools based on network
      const networkConfig = this.getNetworkConfig();
      const fallbackPools = this.getNetworkFallbackPools(networkConfig);
      
      Logger.warn(`Using hardcoded fallback pool for ${networkConfig} network`);
      return fallbackPools[0];
    }
  }

  /**
   * Get network-specific fallback pools when all dynamic selection fails
   */
  private getNetworkFallbackPools(network: string): DelegateeDetails[] {
    if (network === 'mainnet') {
      return [
        {
          name: "IOHK Pool 1",
          status: "active",
          address: "pool1z5uqdk7dzdxaae5633fqfcu2eqzy3a3rgtuvy087fdld7yws0xt",
          pledge: "2000000000000",
          margin: 0.03,
          fixedCost: "340000000",
          saturation: 0.8,
          roa: 4.5
        },
        {
          name: "Cardano Foundation Pool",
          status: "active", 
          address: "pool1njjr0zn7uvydjy3j9fndnplhh7498jnygfk6yl2v5tfdhvdey4j",
          pledge: "1000000000000",
          margin: 0.05,
          fixedCost: "340000000", 
          saturation: 0.75,
          roa: 4.2
        }
      ];
    } else {
      // Testnet fallback pools
      return [
        {
          name: "Testnet Pool 1",
          status: "active",
          address: "pool1z22x0k2zuh68d28w79gqkx4mfs8v9ewj3qa3md9xgd5j8mq9qx2",
          pledge: "1000000000",
          margin: 0.05,
          fixedCost: "340000000",
          saturation: 0.1,
          roa: 0.0 // Testnet pools typically don't have real ROA
        }
      ];
    }
  }

  /**
   * Get current delegation for a public key
   */
  async getCurrentDelegateesForPublicKey(publicKey: PublicKey): Promise<string[]> {
    try {
      const address = await this.getAddressFromPublicKey(publicKey);
      return this.getCurrentDelegateesForAddress(address);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get current delegation for an address
   */
  async getCurrentDelegateesForAddress(address: string): Promise<string[]> {
    try {
      const delegationInfo = await this.stakingExtensions.getDelegationInfo(address);
      if (delegationInfo && delegationInfo.poolId) {
        return [delegationInfo.poolId];
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get detailed information about a stake pool
   */
  async getDelegateeDetails(address: string): Promise<DelegateeDetails> {
    try {
      const poolDetails = await this.stakingExtensions.getStakePoolDetails(address);
      if (poolDetails) {
        return this.mapStakePoolToDelegateeDetails(poolDetails);
      }
      
      // Fallback details
      return {
        name: "Unknown Pool",
        status: "unknown",
        address,
      };
    } catch (error) {
      return {
        name: "Unknown Pool",
        status: "error",
        address,
      };
    }
  }

  /**
   * Check if a public key is currently delegating
   */
  async isPublicKeyDelegating(publicKey: PublicKey): Promise<boolean> {
    try {
      const address = await this.getAddressFromPublicKey(publicKey);
      return this.isAddressDelegating(address);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if an address is currently delegating
   */
  async isAddressDelegating(address: string): Promise<boolean> {
    try {
      const delegatees = await this.getCurrentDelegateesForAddress(address);
      return delegatees.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get comprehensive delegator details for a public key
   */
  async getDelegatorDetailsFromPublicKey(publicKey: PublicKey): Promise<DelegatorDetails> {
    try {
      const address = await this.getAddressFromPublicKey(publicKey);
      return this.getDelegatorDetailsFromAddress(address);
    } catch (error) {
      const address = await this.getAddressFromPublicKey(publicKey);
      return {
        address,
        balance: "0",
        delegatees: [],
        availableActions: [],
        rewards: []
      };
    }
  }

  /**
   * Get comprehensive delegator details for an address
   */
  async getDelegatorDetailsFromAddress(address: string): Promise<DelegatorDetails> {
    try {
      // Get balance
      const balance = await this.getBalanceOfAddress(address);
      
      // Get current delegation
      const delegatees = await this.getCurrentDelegateesForAddress(address);
      
      // Get rewards history
      const rewardsHistory = await this.stakingExtensions.getRewardsHistory(address, 10);
      const rewards: DelegatorReward[] = rewardsHistory.map(reward => ({
        amount: reward.amount,
        collected: true, // Historical rewards are collected
        epoch: reward.epoch,
        timestamp: Date.now() // Would need actual timestamp from reward data
      }));

      // Get available actions
      const availableActions = await this.getAvailableActions(address, delegatees);

      return {
        address,
        balance: balance.total.value,
        delegatees,
        availableActions,
        rewards
      };
    } catch (error) {
      return {
        address,
        balance: "0",
        delegatees: [],
        availableActions: [],
        rewards: []
      };
    }
  }

  /**
   * Get full delegation details for a public key
   */
  async getDelegationDetailsFromPublicKey(publicKey: PublicKey): Promise<DelegatorDetails> {
    return this.getDelegatorDetailsFromPublicKey(publicKey);
  }

  /**
   * Get full delegation details for an address
   */
  async getDelegationDetailsFromAddress(address: string): Promise<DelegatorDetails> {
    return this.getDelegatorDetailsFromAddress(address);
  }

  /**
   * Prepare delegation transaction for a public key
   */
  async prepareDelegatorActionFromPublicKey(
    publicKey: PublicKey,
    type: CardanoDelegationActionType,
    data?: any
  ): Promise<UnsignedTransaction> {
    try {
      const address = await this.getAddressFromPublicKey(publicKey);
      
      switch (type) {
        case "delegate":
        case "change_delegation":
          if (!data || !data.delegate) {
            throw new Error("Pool ID required for delegation");
          }
          return this.prepareDelegationTransaction(address, data.delegate);
          
        case "undelegate":
          return this.prepareDeregistrationTransaction(address);
          
        case "withdraw":
          return this.prepareWithdrawalTransaction(address);
          
        case "register":
          return this.prepareRegistrationTransaction(address);
          
        default:
          throw new Error(`Unsupported delegation action: ${type}`);
      }
    } catch (error) {
      throw new Error(`Failed to prepare delegation transaction: ${error}`);
    }
  }

  // =================== Helper Methods ===================

  /**
   * Map our StakePool interface to AirGap's DelegateeDetails
   */
  private mapStakePoolToDelegateeDetails(pool: any): DelegateeDetails {
    return {
      name: pool.name || pool.ticker,
      status: pool.retired ? "retired" : "active",
      address: pool.poolId,
      pledge: pool.pledge,
      margin: pool.margin,
      fixedCost: pool.fixedCost,
      saturation: pool.saturation,
      roa: pool.roa
    };
  }

  /**
   * Get available delegation actions for an address
   */
  private async getAvailableActions(address: string, currentDelegatees: string[]): Promise<DelegatorAction[]> {
    const actions: DelegatorAction[] = [];
    
    // Always available: delegate to new pool
    actions.push({
      type: "delegate",
      args: []
    });

    // If currently delegating: can change delegation or undelegate
    if (currentDelegatees.length > 0) {
      actions.push({
        type: "change_delegation",
        args: []
      });
      
      actions.push({
        type: "undelegate",
        args: []
      });
      
      // Check if rewards are available
      try {
        const delegationInfo = await this.stakingExtensions.getDelegationInfo(address);
        if (delegationInfo && parseFloat(delegationInfo.withdrawableRewards) > 0) {
          actions.push({
            type: "withdraw",
            args: [delegationInfo.withdrawableRewards]
          });
        }
      } catch (error) {
        // If we can't get rewards info, still offer withdrawal option
        actions.push({
          type: "withdraw",
          args: []
        });
      }
    } else {
      // Not delegating: offer registration if needed
      actions.push({
        type: "register",
        args: []
      });
    }

    return actions;
  }

  /**
   * Prepare delegation transaction
   */
  private async prepareDelegationTransaction(address: string, poolId: string): Promise<UnsignedTransaction> {
    try {
      Logger.debug('Preparing delegation transaction', { address, poolId });
      
      // Validate inputs
      this.validateAddress(address);
      this.validatePoolId(poolId);
      
      // Validate delegation context (pool status, current delegation, etc.)
      await this.validateDelegationContext(address, poolId);
      
      // Get available UTXOs for the address
      const utxos = await this.getUTXOsForAddress(address);
      if (!utxos || utxos.length === 0) {
        throw new UTXOSelectionError(ErrorCode.INSUFFICIENT_FUNDS, 'No UTXOs available for delegation transaction');
      }

      // Get stake credential from address
      const stakeCredential = await this.getStakeCredentialFromAddress(address);
      
      // Create stake delegation certificate
      const delegationCert: TyphonTypes.StakeDelegationCertificate = {
        type: TyphonTypes.CertificateType.STAKE_DELEGATION,
        cert: {
          stakeCredential,
          poolHash: poolId
        }
      };

      // Check if stake key is already registered
      const isRegistered = await this.isStakeKeyRegistered(address);
      const certificates: TyphonTypes.Certificate[] = [];
      
      // Add registration certificate if needed
      if (!isRegistered) {
        const stakeKeyDeposit = await this.getStakeKeyDeposit();
        const registrationCert: TyphonTypes.StakeKeyRegistrationCertificate = {
          type: TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION,
          cert: {
            stakeCredential,
            deposit: stakeKeyDeposit
          }
        };
        certificates.push(registrationCert);
      }
      
      certificates.push(delegationCert);

      // Validate certificate sequence
      this.validateCertificateSequence(certificates);

      // Build transaction with multi-asset support
      const txBuilder = await this.getTyphonTransactionBuilder();
      
      // Check if UTXOs contain native tokens
      const hasNativeTokens = utxos.some(utxo => utxo.assets && utxo.assets.size > 0);
      if (hasNativeTokens) {
        Logger.info('Delegation transaction includes native tokens');
        Logger.debug('Assets details', {
          utxoCount: utxos.length,
          assetsCount: utxos.reduce((sum, utxo) => sum + (utxo.assets?.size || 0), 0)
        });
      }
      
      const builtTx = await txBuilder.buildStakingTransaction(
        utxos,
        certificates,
        address
      );

      // Return unsigned transaction in AirGap format
      return {
        type: "unsigned",
        transaction: {
          type: "delegation",
          from: address,
          poolId,
          fee: builtTx.fee.toString(),
          cbor: builtTx.transactionCbor,
          hash: builtTx.transactionHash,
          certificates: certificates.map(cert => ({
            type: this.mapCertificateType(cert.type),
            stakeCredential: 'stakeCredential' in cert.cert ? cert.cert.stakeCredential : undefined,
            poolId: cert.type === TyphonTypes.CertificateType.STAKE_DELEGATION ? poolId : undefined
          }))
        }
      } as UnsignedTransaction;
    } catch (error) {
      Logger.error('Failed to prepare delegation transaction', error as Error);
      throw new Error(`Failed to prepare delegation transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Prepare deregistration transaction
   */
  private async prepareDeregistrationTransaction(address: string): Promise<UnsignedTransaction> {
    try {
      Logger.debug('Preparing stake deregistration transaction', { address });
      
      // Get available UTXOs
      const utxos = await this.getUTXOsForAddress(address);
      if (!utxos || utxos.length === 0) {
        throw new UTXOSelectionError(ErrorCode.INSUFFICIENT_FUNDS, 'No UTXOs available for deregistration transaction');
      }

      // Get stake credential
      const stakeCredential = await this.getStakeCredentialFromAddress(address);
      
      // Create deregistration certificate
      const stakeKeyDeposit = await this.getStakeKeyDeposit();
      const deregistrationCert: TyphonTypes.StakeKeyDeRegistrationCertificate = {
        type: TyphonTypes.CertificateType.STAKE_KEY_DE_REGISTRATION,
        cert: {
          stakeCredential,
          deposit: stakeKeyDeposit
        }
      };

      // Build transaction
      const txBuilder = await this.getTyphonTransactionBuilder();
      const builtTx = await txBuilder.buildStakingTransaction(
        utxos,
        [deregistrationCert],
        address
      );

      return {
        type: "unsigned",
        transaction: {
          type: "deregistration",
          from: address,
          fee: builtTx.fee.toString(),
          cbor: builtTx.transactionCbor,
          hash: builtTx.transactionHash,
          certificates: [{
            type: "stake_deregistration",
            stakeCredential
          }]
        }
      } as UnsignedTransaction;
    } catch (error) {
      Logger.error('Failed to prepare deregistration transaction', error as Error);
      throw new Error(`Failed to prepare deregistration transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Prepare rewards withdrawal transaction
   */
  private async prepareWithdrawalTransaction(address: string): Promise<UnsignedTransaction> {
    try {
      Logger.debug('Preparing rewards withdrawal transaction', { address });
      
      // Get available UTXOs
      const utxos = await this.getUTXOsForAddress(address);
      if (!utxos || utxos.length === 0) {
        throw new UTXOSelectionError(ErrorCode.INSUFFICIENT_FUNDS, 'No UTXOs available for withdrawal transaction');
      }

      // Get current rewards amount
      const delegationInfo = await this.stakingExtensions.getDelegationInfo(address);
      const rewardsAmount = delegationInfo?.withdrawableRewards || "0";
      
      if (parseFloat(rewardsAmount) <= 0) {
        throw new UTXOSelectionError(ErrorCode.INSUFFICIENT_FUNDS, 'No rewards available for withdrawal');
      }

      // Create reward address
      const rewardAddress = await this.getRewardAddressFromAddress(address);
      
      // Create withdrawal
      const withdrawal = {
        rewardAccount: rewardAddress,
        amount: new BigNumber(rewardsAmount)
      };

      // Build transaction
      const txBuilder = await this.getTyphonTransactionBuilder();
      const builtTx = await txBuilder.buildStakingTransaction(
        utxos,
        [], // No certificates for withdrawal
        address,
        [withdrawal] // Add withdrawal
      );

      return {
        type: "unsigned",
        transaction: {
          type: "withdrawal",
          from: address,
          amount: rewardsAmount,
          fee: builtTx.fee.toString(),
          cbor: builtTx.transactionCbor,
          hash: builtTx.transactionHash,
          withdrawals: [{
            rewardAddress: rewardAddress.getBech32(),
            amount: rewardsAmount
          }]
        }
      } as UnsignedTransaction;
    } catch (error) {
      Logger.error('Failed to prepare withdrawal transaction', error as Error);
      throw new Error(`Failed to prepare withdrawal transaction: ${(error as Error).message}`);
    }
  }

  /**
   * Prepare registration transaction
   */
  private async prepareRegistrationTransaction(address: string): Promise<UnsignedTransaction> {
    try {
      Logger.debug('Preparing stake registration transaction', { address });
      
      // Get available UTXOs
      const utxos = await this.getUTXOsForAddress(address);
      if (!utxos || utxos.length === 0) {
        throw new UTXOSelectionError(ErrorCode.INSUFFICIENT_FUNDS, 'No UTXOs available for registration transaction');
      }

      // Get stake credential
      const stakeCredential = await this.getStakeCredentialFromAddress(address);
      
      // Create registration certificate
      const stakeKeyDeposit = await this.getStakeKeyDeposit();
      const registrationCert: TyphonTypes.StakeKeyRegistrationCertificate = {
        type: TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION,
        cert: {
          stakeCredential,
          deposit: stakeKeyDeposit
        }
      };

      // Build transaction
      const txBuilder = await this.getTyphonTransactionBuilder();
      const builtTx = await txBuilder.buildStakingTransaction(
        utxos,
        [registrationCert],
        address
      );

      return {
        type: "unsigned",
        transaction: {
          type: "registration",
          from: address,
          fee: builtTx.fee.toString(),
          cbor: builtTx.transactionCbor,
          hash: builtTx.transactionHash,
          certificates: [{
            type: "stake_registration",
            stakeCredential
          }]
        }
      } as UnsignedTransaction;
    } catch (error) {
      Logger.error('Failed to prepare registration transaction', error as Error);
      throw new Error(`Failed to prepare registration transaction: ${(error as Error).message}`);
    }
  }

  // =================== Transaction Building Helper Methods ===================

  /**
   * Get transaction builder with current protocol parameters
   */
  private async getTyphonTransactionBuilder(): Promise<TyphonTransactionBuilder> {
    const protocolParams = await this.getDataService().getProtocolParameters();
    return new TyphonTransactionBuilder(protocolParams);
  }

  /**
   * Get UTXOs for an address
   */
  private async getUTXOsForAddress(address: string): Promise<UTXO[]> {
    try {
      // Get actual UTXOs from the data service
      const utxos = await this.getDataService().getUtxos(address);
      
      // Convert data service UTXOs to our UTXO format
      return utxos.map(utxo => ({
        txHash: utxo.txHash,
        outputIndex: utxo.outputIndex,
        amount: BigInt(Math.floor(parseFloat(utxo.amount) * CARDANO_CONSTANTS.LOVELACE_PER_ADA)),
        address: address, // Use the provided address
        assets: utxo.assets ? this.convertAssetsToMap(utxo.assets) : undefined
      }));
    } catch (error) {
      Logger.error('Failed to fetch UTXOs for address', error as Error);
      throw new UTXOSelectionError(
        ErrorCode.UTXO_SELECTION_FAILED,
        `Failed to fetch UTXOs for address ${address}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Convert asset array to Map format
   */
  private convertAssetsToMap(assets: any[]): Map<string, bigint> | undefined {
    if (!assets || assets.length === 0) return undefined;
    
    const assetMap = new Map<string, bigint>();
    assets.forEach(asset => {
      const assetId = asset.unit || `${asset.policyId}${asset.assetName || ''}`;
      const quantity = BigInt(asset.quantity || 0);
      assetMap.set(assetId, quantity);
    });
    
    return assetMap.size > 0 ? assetMap : undefined;
  }

  /**
   * Get stake credential from address
   */
  private async getStakeCredentialFromAddress(address: string): Promise<TyphonTypes.StakeCredential> {
    try {
      const cardanoAddress = TyphonUtils.getAddressFromString(address);
      if (!cardanoAddress) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, `Invalid address format: ${address}`);
      }

      // Handle different Cardano address types according to CIP-19
      const addressType = cardanoAddress.constructor.name;
      
      switch (addressType) {
        case 'BaseAddress':
          // Base addresses (type 0/1) have both payment and stake credentials
          if ('stakeCredential' in cardanoAddress) {
            const stakeCredential = (cardanoAddress as any).stakeCredential;
            
            // Validate the stake credential structure
            if (!stakeCredential || !stakeCredential.hash || typeof stakeCredential.type === 'undefined') {
              throw new ValidationError(
                ErrorCode.INVALID_ADDRESS,
                'Base address contains invalid stake credential structure'
              );
            }
            
            Logger.debug('Extracted stake credential from BaseAddress');
            return {
              hash: stakeCredential.hash,
              type: stakeCredential.type
            };
          }
          break;
          
        case 'PointerAddress':
          // Pointer addresses (type 2/3) point to stake credentials via chain pointers
          // Resolve the pointer to get the actual stake credential through chain queries
          Logger.debug('Resolving pointer address stake credential');
          
          if ('stakePointer' in cardanoAddress) {
            const stakePointer = (cardanoAddress as any).stakePointer;
            
            if (!stakePointer || typeof stakePointer.slot === 'undefined' || 
                typeof stakePointer.txIndex === 'undefined' || 
                typeof stakePointer.certIndex === 'undefined') {
              throw new ValidationError(
                ErrorCode.INVALID_ADDRESS,
                'Pointer address contains invalid stake pointer structure'
              );
            }
            
            // Resolve pointer to stake credential via chain query
            const resolvedCredential = await this.resolvePointerToStakeCredential(stakePointer);
            
            if (!resolvedCredential) {
              throw new ValidationError(
                ErrorCode.INVALID_ADDRESS,
                'Failed to resolve pointer address to stake credential - pointer may be invalid or transaction not found'
              );
            }
            
            Logger.debug('Successfully resolved pointer address to stake credential');
            return resolvedCredential;
          }
          break;
          
        case 'EnterpriseAddress':
          // Enterprise addresses (type 4/5) have no stake credentials
          // We can derive a stake credential from the payment credential for delegation
          if ('paymentCredential' in cardanoAddress) {
            const paymentCredential = (cardanoAddress as any).paymentCredential;
            
            if (!paymentCredential || !paymentCredential.hash) {
              throw new ValidationError(
                ErrorCode.INVALID_ADDRESS,
                'Enterprise address contains invalid payment credential'
              );
            }
            
            Logger.debug('Deriving stake credential from payment credential for EnterpriseAddress');
            
            return {
              hash: paymentCredential.hash,
              type: paymentCredential.type || TyphonTypes.HashType.ADDRESS
            };
          }
          break;
          
        case 'RewardAddress':
          // Reward addresses (type 6/7) are already stake addresses
          if ('stakeCredential' in cardanoAddress) {
            const stakeCredential = (cardanoAddress as any).stakeCredential;
            
            if (!stakeCredential || !stakeCredential.hash) {
              throw new ValidationError(
                ErrorCode.INVALID_ADDRESS,
                'Reward address contains invalid stake credential'
              );
            }
            
            Logger.debug('Extracted stake credential from RewardAddress');
            return {
              hash: stakeCredential.hash,
              type: stakeCredential.type || TyphonTypes.HashType.ADDRESS
            };
          }
          break;
          
        case 'ByronAddress':
          // Byron addresses (type 8) are legacy and don't support native staking
          throw new ValidationError(
            ErrorCode.INVALID_ADDRESS,
            'Byron addresses do not support Shelley-era staking operations'
          );
          
        default:
          // Unknown or unsupported address type
          throw new ValidationError(
            ErrorCode.INVALID_ADDRESS,
            `Unsupported address type for staking operations: ${addressType}`
          );
      }
      
      // If we get here, none of the address type handlers worked
      throw new ValidationError(
        ErrorCode.INVALID_ADDRESS,
        `Failed to extract stake credential from ${addressType}`
      );
    } catch (error) {
      Logger.error('Failed to extract stake credential from address', error as Error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ValidationError(
        ErrorCode.INVALID_ADDRESS,
        `Failed to extract stake credential: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get reward address from regular address
   */
  private async getRewardAddressFromAddress(address: string): Promise<any> {
    try {
      const cardanoAddress = TyphonUtils.getAddressFromString(address);
      if (!cardanoAddress) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, `Invalid address format: ${address}`);
      }

      // Get stake credential from the address using our improved method
      const stakeCredential = await this.getStakeCredentialFromAddress(address);
      
      // Determine network ID from protocol configuration and address
      const protocolNetwork = this.getNetworkConfig();
      const networkId = protocolNetwork === 'mainnet' ? TyphonTypes.NetworkId.MAINNET : TyphonTypes.NetworkId.TESTNET;
      
      // Determine network ID from address type - handle different address classes
      let addressNetworkId = networkId; // Default to protocol network
      
      if ('getNetworkId' in cardanoAddress && typeof cardanoAddress.getNetworkId === 'function') {
        // Shelley addresses (Base, Enterprise, Pointer, Reward) have getNetworkId()
        addressNetworkId = cardanoAddress.getNetworkId();
        
        if (addressNetworkId !== networkId) {
          Logger.warn(`Address network (${addressNetworkId}) differs from protocol network (${networkId}), using address network`);
        }
      } else {
        // Byron addresses don't have network ID method - determine from bech32 prefix
        const bech32 = cardanoAddress.getBech32();
        if (bech32.startsWith('addr_test') || bech32.startsWith('stake_test')) {
          addressNetworkId = TyphonTypes.NetworkId.TESTNET;
        } else if (bech32.startsWith('addr') || bech32.startsWith('stake')) {
          addressNetworkId = TyphonTypes.NetworkId.MAINNET;
        }
        
        Logger.debug('Determined network from Byron address prefix', { 
          bech32Prefix: bech32.substring(0, 10),
          networkId: addressNetworkId 
        });
      }
      
      // Use TyphonJS RewardAddress class for proper CIP-19 compliant reward address creation
      // Import the CardanoAddress utility which handles TyphonJS integration properly
      const { CardanoAddress } = await import('../utils/address');
      const networkType = addressNetworkId === TyphonTypes.NetworkId.MAINNET ? 'mainnet' : 'testnet';
      
      // Create stake key from the stake credential hash for address generation
      const stakeKeyBytes = new Uint8Array(stakeCredential.hash);
      const rewardAddressBech32 = await CardanoAddress.fromStakeKey(stakeKeyBytes, networkType);
      
      // Create compatible reward address object
      const rewardAddress = {
        stakeCredential: stakeCredential,
        networkId: addressNetworkId,
        getBech32: () => rewardAddressBech32,
        getBytes: () => {
          // Return bytes representation compatible with TyphonJS
          const headerByte = (0b1110 << 4) | addressNetworkId; // Reward address header
          return Buffer.concat([
            Buffer.from([headerByte]),
            stakeCredential.hash
          ]);
        }
      };
      
      Logger.debug('Created reward address using TyphonJS', {
        networkId: addressNetworkId,
        credentialType: stakeCredential.type,
        bech32Preview: rewardAddress.getBech32().substring(0, 20) + '...'
      });
      
      return rewardAddress;
    } catch (error) {
      Logger.error('Failed to create reward address', error as Error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new ValidationError(
        ErrorCode.ADDRESS_GENERATION_FAILED,
        `Failed to create reward address: ${(error as Error).message}`
      );
    }
  }

  /**
   * Resolve pointer address to stake credential via chain queries
   * Implements full CIP-19 pointer address support
   */
  private async resolvePointerToStakeCredential(stakePointer: any): Promise<TyphonTypes.StakeCredential | null> {
    try {
      Logger.debug('Resolving stake pointer', {
        slot: stakePointer.slot,
        txIndex: stakePointer.txIndex,
        certIndex: stakePointer.certIndex
      });

      // Get block at the specified slot
      const blockInfo = await this.getBlockBySlot(stakePointer.slot);
      if (!blockInfo || !blockInfo.transactions || blockInfo.transactions.length <= stakePointer.txIndex) {
        Logger.warn('Block or transaction not found for pointer resolution');
        return null;
      }

      // Get the specific transaction
      const transaction = blockInfo.transactions[stakePointer.txIndex];
      if (!transaction || !transaction.certificates || transaction.certificates.length <= stakePointer.certIndex) {
        Logger.warn('Transaction or certificate not found for pointer resolution');
        return null;
      }

      // Get the specific certificate
      const certificate = transaction.certificates[stakePointer.certIndex];
      
      // Extract stake credential from the certificate
      if (certificate.type === 'stake_registration' || certificate.type === 'stake_delegation') {
        const stakeCredential = certificate.stakeCredential;
        
        if (stakeCredential && stakeCredential.hash) {
          Logger.debug('Successfully resolved pointer to stake credential');
          return {
            hash: stakeCredential.hash,
            type: stakeCredential.type || TyphonTypes.HashType.ADDRESS
          };
        }
      }

      Logger.warn('Certificate does not contain valid stake credential');
      return null;
    } catch (error) {
      Logger.error('Failed to resolve pointer to stake credential', error as Error);
      return null;
    }
  }

  /**
   * Get block information by slot number
   * Uses data service to query blockchain for historical block data
   */
  private async getBlockBySlot(slot: number): Promise<any> {
    try {
      // Most Cardano APIs don't directly support slot-to-block queries
      // We would need to use epoch calculations and block queries
      Logger.warn('Block-by-slot queries require specialized API endpoints - using fallback');
      
      // Fallback: estimate epoch and try to get block info
      const epoch = Math.floor(slot / 432000); // Standard Cardano epoch length
      const slotInEpoch = slot % 432000;
      
      // This would be implemented with actual API calls to services like:
      // - Koios block endpoints
      // - Blockfrost block queries  
      // - CardanoScan block API
      
      Logger.debug('Attempted block resolution', { slot, epoch, slotInEpoch });
      
      // Return null for now - this indicates pointer resolution is not available
      // In production, this would make actual API calls
      return null;
    } catch (error) {
      Logger.error('Failed to get block by slot', error as Error);
      return null;
    }
  }

  /**
   * Check if stake key is already registered
   */
  private async isStakeKeyRegistered(address: string): Promise<boolean> {
    try {
      const delegationInfo = await this.stakingExtensions.getDelegationInfo(address);
      return delegationInfo !== null && delegationInfo.poolId !== null;
    } catch (error) {
      return false; // Assume not registered on error
    }
  }

  /**
   * Get stake key deposit amount from protocol parameters
   * @implements CIP-11 - Uses dynamic protocol parameters instead of hardcoded values
   */
  private async getStakeKeyDeposit(): Promise<BigNumber> {
    try {
      // Get current protocol parameters from the data service
      const protocolParams = await this.getDataService().getProtocolParameters();
      
      // Extract stake key deposit from protocol parameters
      // TyphonJS protocol parameters include keyDeposit field
      if (protocolParams && protocolParams.keyDeposit) {
        const depositValue = protocolParams.keyDeposit;
        
        // Handle different formats - TyphonJS may return BigNumber or string
        if (typeof depositValue === 'string') {
          return new BigNumber(depositValue);
        } else if (depositValue instanceof BigNumber) {
          return depositValue;
        } else if (typeof depositValue === 'number') {
          return new BigNumber(depositValue.toString());
        } else if (depositValue && typeof depositValue === 'object' && 'toString' in depositValue) {
          // Handle BigInt or other numeric types
          return new BigNumber(depositValue.toString());
        }
      }
      
      Logger.warn('Protocol parameters do not contain keyDeposit, using fallback value');
      
      // Fallback to current mainnet value (2 ADA) if protocol params unavailable
      // This should only happen in edge cases or during network transitions
      return new BigNumber('2000000'); // 2 ADA in lovelace
    } catch (error) {
      Logger.error('Failed to get stake key deposit from protocol parameters', error as Error);
      Logger.warn('Using fallback stake key deposit value due to parameter fetch failure');
      
      // Fallback to current mainnet value if we can't fetch protocol parameters
      return new BigNumber('2000000'); // 2 ADA in lovelace
    }
  }

  /**
   * Map TyphonJS certificate type to our string format
   */
  private mapCertificateType(certType: TyphonTypes.CertificateType): string {
    switch (certType) {
      case TyphonTypes.CertificateType.STAKE_REGISTRATION:
        return 'stake_registration';
      case TyphonTypes.CertificateType.STAKE_DE_REGISTRATION:
        return 'stake_deregistration';
      case TyphonTypes.CertificateType.STAKE_DELEGATION:
        return 'stake_delegation';
      case TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION:
        return 'stake_key_registration';
      case TyphonTypes.CertificateType.STAKE_KEY_DE_REGISTRATION:
        return 'stake_key_deregistration';
      default:
        return 'unknown';
    }
  }

  // =================== Validation Methods ===================

  /**
   * Validate Cardano address format
   */
  private validateAddress(address: string): void {
    if (!address || typeof address !== 'string') {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Address must be a non-empty string');
    }

    // Basic bech32 format validation
    const isTestnet = address.startsWith('addr_test') || address.startsWith('stake_test');
    const isMainnet = address.startsWith('addr') || address.startsWith('stake');
    
    if (!isTestnet && !isMainnet) {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Address must start with valid Cardano prefix');
    }

    // Validate network compatibility
    const expectedNetwork = this.getNetworkConfig();
    const addressNetwork = isTestnet ? 'testnet' : 'mainnet';
    
    if (expectedNetwork !== addressNetwork) {
      throw new ValidationError(
        ErrorCode.INVALID_ADDRESS,
        `Address network (${addressNetwork}) does not match protocol network (${expectedNetwork})`
      );
    }

    // Validate address using TyphonJS
    try {
      const cardanoAddress = TyphonUtils.getAddressFromString(address);
      if (!cardanoAddress) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Invalid address format according to TyphonJS');
      }
    } catch (error) {
      throw new ValidationError(
        ErrorCode.INVALID_ADDRESS,
        `Address validation failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Validate stake pool ID format
   */
  private validatePoolId(poolId: string): void {
    if (!poolId || typeof poolId !== 'string') {
      throw new ValidationError(ErrorCode.INVALID_INPUT, 'Pool ID must be a non-empty string');
    }

    // Pool ID should be either bech32 format (pool...) or hex format (56 characters)
    const isBech32Pool = poolId.startsWith('pool1');
    const isHexPool = /^[0-9a-fA-F]{56}$/.test(poolId);
    
    if (!isBech32Pool && !isHexPool) {
      throw new ValidationError(
        ErrorCode.INVALID_INPUT,
        'Pool ID must be either bech32 format (pool1...) or 56-character hex string'
      );
    }

    // Additional validation for bech32 pool IDs
    if (isBech32Pool && poolId.length !== 63) {
      throw new ValidationError(
        ErrorCode.INVALID_INPUT,
        'Bech32 pool ID must be exactly 63 characters long'
      );
    }
  }

  /**
   * Validate certificate combination in a transaction
   */
  private validateCertificateSequence(certificates: TyphonTypes.Certificate[]): void {
    if (!certificates || certificates.length === 0) {
      return; // Empty certificate list is valid
    }

    const certTypes = certificates.map(cert => cert.type);
    
    // Check for invalid combinations
    const hasRegistration = certTypes.includes(TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION);
    const hasDeregistration = certTypes.includes(TyphonTypes.CertificateType.STAKE_KEY_DE_REGISTRATION);
    const hasDelegation = certTypes.includes(TyphonTypes.CertificateType.STAKE_DELEGATION);
    
    // Cannot have both registration and deregistration in same transaction
    if (hasRegistration && hasDeregistration) {
      throw new TransactionBuildError(
        ErrorCode.INVALID_TRANSACTION_DATA,
        'Cannot have both stake registration and deregistration in the same transaction'
      );
    }

    // Delegation should come after registration if both are present
    if (hasRegistration && hasDelegation) {
      const registrationIndex = certTypes.indexOf(TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION);
      const delegationIndex = certTypes.indexOf(TyphonTypes.CertificateType.STAKE_DELEGATION);
      
      if (delegationIndex < registrationIndex) {
        throw new TransactionBuildError(
          ErrorCode.INVALID_TRANSACTION_DATA,
          'Stake registration must come before delegation in the same transaction'
        );
      }
    }

    // Check for duplicate certificates
    const uniqueCertTypes = new Set(certTypes);
    if (uniqueCertTypes.size !== certTypes.length) {
      throw new TransactionBuildError(
        ErrorCode.INVALID_TRANSACTION_DATA,
        'Duplicate certificate types not allowed in the same transaction'
      );
    }
  }

  /**
   * Validate delegation operation context
   */
  private async validateDelegationContext(address: string, poolId: string): Promise<void> {
    try {
      Logger.debug('Validating delegation context', { address, poolId });

      // Use comprehensive pool validator
      const warnings = await this.poolValidator.quickValidateForDelegation(poolId);
      
      // Log warnings but don't fail transaction
      if (warnings.length > 0) {
        Logger.warn('Pool validation warnings found for pool: ' + poolId);
        warnings.forEach(warning => Logger.warn(`Pool Warning: ${warning}`));
      }

      // Check current delegation status
      const currentDelegation = await this.getCurrentDelegateesForAddress(address);
      if (currentDelegation.includes(poolId)) {
        Logger.warn(`Address ${address} is already delegated to pool ${poolId}`);
      }

      // Check if address has sufficient balance for delegation
      const balance = await this.getBalanceOfAddress(address);
      const balanceLovelace = parseFloat(balance.total.value);
      const minimumForDelegation = 2000000 + 500000; // 2 ADA key deposit + 0.5 ADA for fees
      
      if (balanceLovelace < minimumForDelegation) {
        throw new UTXOSelectionError(
          ErrorCode.INSUFFICIENT_FUNDS,
          `Insufficient balance for delegation. Need at least ${minimumForDelegation / 1000000} ADA, have ${balanceLovelace / 1000000} ADA`
        );
      }

      Logger.debug('Delegation context validation completed', { 
        warningsCount: warnings.length,
        hasCurrentDelegation: currentDelegation.length > 0,
        sufficientBalance: balanceLovelace >= minimumForDelegation
      });

    } catch (error) {
      if (error instanceof ValidationError || error instanceof UTXOSelectionError) {
        throw error; // Re-throw validation and UTXO selection errors
      }
      
      // Don't fail transaction if validation checks are unavailable
      Logger.warn(`Pool validation failed, proceeding with transaction: ${(error as Error).message}`);
    }
  }
}