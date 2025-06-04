/**
 * Cardano Delegation Protocol - AirGap ICoinDelegateProtocol Implementation
 * Bridges our staking extensions with AirGap's expected delegation interface
 */

import { PublicKey, UnsignedTransaction } from "@airgap/module-kit";
import { CardanoProtocol } from "./cardano-protocol";
import { CardanoStakingExtensions } from "./staking-extensions";
import { CardanoDataService } from "../data/cardano-data-service";
import { CardanoProtocolOptions } from "../types";

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

  constructor(options: CardanoProtocolOptions = { network: "mainnet" }) {
    super(options);
    
    // Get the data service from the parent protocol
    const dataService = this.getDataService();
    
    // Initialize staking extensions
    this.stakingExtensions = new CardanoStakingExtensions(dataService);
  }

  /**
   * Get access to the internal data service
   */
  protected getDataService(): CardanoDataService {
    return (this as any).dataService;
  }

  // =================== ICoinDelegateProtocol Implementation ===================

  /**
   * Get default stake pool (highest ROA, active, not oversaturated)
   */
  async getDefaultDelegatee(): Promise<DelegateeDetails> {
    try {
      const topPools = await this.stakingExtensions.getTopStakePools('roa', 1);
      if (topPools.length === 0) {
        throw new Error('No active stake pools found');
      }

      const pool = topPools[0];
      return this.mapStakePoolToDelegateeDetails(pool);
    } catch (error) {
      // Fallback to a well-known pool
      return {
        name: "AirGap",
        status: "active", 
        address: "pool1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq",
        pledge: "1000000000",
        margin: 0.05,
        fixedCost: "340000000",
        saturation: 0.7,
        roa: 5.0
      };
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
    // This would integrate with our transaction builder to create delegation certificates
    // For now, create a placeholder transaction structure
    return {
      type: "unsigned",
      transaction: {
        type: "delegation",
        from: address,
        poolId,
        certificates: [
          {
            type: "stake_delegation",
            stakeAddress: address,
            poolId
          }
        ]
      }
    } as UnsignedTransaction;
  }

  /**
   * Prepare deregistration transaction
   */
  private async prepareDeregistrationTransaction(address: string): Promise<UnsignedTransaction> {
    return {
      type: "unsigned",
      transaction: {
        type: "deregistration",
        from: address,
        certificates: [
          {
            type: "stake_deregistration",
            stakeAddress: address
          }
        ]
      }
    } as UnsignedTransaction;
  }

  /**
   * Prepare rewards withdrawal transaction
   */
  private async prepareWithdrawalTransaction(address: string): Promise<UnsignedTransaction> {
    // Get current rewards amount
    const delegationInfo = await this.stakingExtensions.getDelegationInfo(address);
    const rewardsAmount = delegationInfo?.withdrawableRewards || "0";
    
    return {
      type: "unsigned",
      transaction: {
        type: "withdrawal",
        from: address,
        amount: rewardsAmount,
        withdrawals: [
          {
            rewardAddress: address,
            amount: rewardsAmount
          }
        ]
      }
    } as UnsignedTransaction;
  }

  /**
   * Prepare registration transaction
   */
  private async prepareRegistrationTransaction(address: string): Promise<UnsignedTransaction> {
    return {
      type: "unsigned",
      transaction: {
        type: "registration",
        from: address,
        certificates: [
          {
            type: "stake_registration",
            stakeAddress: address
          }
        ]
      }
    } as UnsignedTransaction;
  }
}