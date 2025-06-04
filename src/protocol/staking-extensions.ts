/**
 * Cardano Staking & Delegation Extensions for AirGap Online Protocol
 * Implements CIP-11 delegation functionality with stake pool integration
 */

import { Amount } from "@airgap/module-kit";
import { CardanoDataService } from "../data/cardano-data-service";
import { Logger } from "../utils";
// Use AirGap's embedded axios to avoid CORS issues
import axios from '@airgap/coinlib-core/dependencies/src/axios-0.19.0';

export interface StakePool {
  poolId: string;
  ticker: string;
  name: string;
  description?: string;
  homepage?: string;
  pledge: string; // lovelace
  margin: number; // percentage (0-1)
  fixedCost: string; // lovelace
  saturation: number; // percentage (0-1)
  activeStake: string; // lovelace
  liveStake: string; // lovelace
  blocksEpoch: number;
  blocksLifetime: number;
  roa: number; // return on ada (%)
  retired?: boolean;
  metadata?: {
    url?: string;
    hash?: string;
  };
}

export interface DelegationInfo {
  address: string;
  poolId: string | null;
  activeStake: string; // lovelace
  rewards: string; // lovelace
  withdrawableRewards: string; // lovelace
  epoch: number;
  delegationTxHash?: string;
}

export interface RewardHistory {
  epoch: number;
  amount: string; // lovelace
  poolId: string;
  type: "member" | "leader" | "treasury" | "reserves";
}

export interface StakingActivity {
  txHash: string;
  epoch: number;
  action: "registration" | "delegation" | "withdrawal" | "deregistration";
  poolId?: string;
  amount?: string; // for withdrawals
  certIndex: number;
}

/**
 * Enhanced staking functionality for Cardano AirGap protocol
 */
export class CardanoStakingExtensions {
  constructor(private dataService: CardanoDataService) {}

  /**
   * Get comprehensive list of all active stake pools
   */
  async getStakePools(): Promise<StakePool[]> {
    try {
      // Use Koios pool list endpoint
      const response = await axios.post('https://api.koios.rest/api/v1/pool_list', {}, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status !== 200) throw new Error(`Failed to fetch stake pools: ${response.status}`);
      
      const pools = response.data as any[];
      
      return pools.map(pool => ({
        poolId: pool.pool_id_bech32,
        ticker: pool.ticker || pool.pool_id_bech32.slice(0, 8),
        name: pool.meta_json?.name || pool.ticker || 'Unknown Pool',
        description: pool.meta_json?.description,
        homepage: pool.meta_json?.homepage,
        pledge: pool.pledge,
        margin: parseFloat(pool.margin) / 100,
        fixedCost: pool.fixed_cost,
        saturation: parseFloat(pool.live_saturation || '0'),
        activeStake: pool.active_stake,
        liveStake: pool.live_stake,
        blocksEpoch: parseInt(pool.block_count) || 0,
        blocksLifetime: parseInt(pool.block_count_total) || 0,
        roa: parseFloat(pool.roa || '0'),
        retired: pool.retiring_epoch !== null,
        metadata: pool.meta_url ? {
          url: pool.meta_url,
          hash: pool.meta_hash
        } : undefined
      }));
    } catch (error) {
      Logger.error('Failed to fetch stake pools', error as Error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific stake pool
   */
  async getStakePoolDetails(poolId: string): Promise<StakePool | null> {
    try {
      const response = await axios.post('https://api.koios.rest/api/v1/pool_info', {
        _pool_bech32_ids: [poolId]
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status !== 200) throw new Error(`Failed to fetch pool details: ${response.status}`);
      
      const pools = response.data as any[];
      if (pools.length === 0) return null;

      const pool = pools[0];
      return {
        poolId: pool.pool_id_bech32,
        ticker: pool.ticker || pool.pool_id_bech32.slice(0, 8),
        name: pool.meta_json?.name || pool.ticker || 'Unknown Pool',
        description: pool.meta_json?.description,
        homepage: pool.meta_json?.homepage,
        pledge: pool.pledge,
        margin: parseFloat(pool.margin) / 100,
        fixedCost: pool.fixed_cost,
        saturation: parseFloat(pool.live_saturation || '0'),
        activeStake: pool.active_stake,
        liveStake: pool.live_stake,
        blocksEpoch: parseInt(pool.block_count) || 0,
        blocksLifetime: parseInt(pool.block_count_total) || 0,
        roa: parseFloat(pool.roa || '0'),
        retired: pool.retiring_epoch !== null,
        metadata: pool.meta_url ? {
          url: pool.meta_url,
          hash: pool.meta_hash
        } : undefined
      };
    } catch (error) {
      Logger.error('Failed to fetch pool details', error as Error);
      return null;
    }
  }

  /**
   * Get current delegation status for an address
   */
  async getDelegationInfo(address: string): Promise<DelegationInfo | null> {
    try {
      const response = await axios.post('https://api.koios.rest/api/v1/account_info', {
        _addresses: [address]
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status !== 200) throw new Error(`Failed to fetch delegation info: ${response.status}`);
      
      const accounts = response.data as any[];
      if (accounts.length === 0) return null;

      const account = accounts[0];
      return {
        address,
        poolId: account.delegated_pool,
        activeStake: account.total_balance || '0',
        rewards: account.rewards_available || '0',
        withdrawableRewards: account.withdrawable_amount || '0',
        epoch: parseInt(account.active_epoch_no) || 0,
        delegationTxHash: account.delegation_tx_hash
      };
    } catch (error) {
      Logger.error('Failed to fetch delegation info', error as Error);
      return null;
    }
  }

  /**
   * Get staking rewards history for an address
   */
  async getRewardsHistory(address: string, limit: number = 50): Promise<RewardHistory[]> {
    try {
      const response = await axios.post('https://api.koios.rest/api/v1/account_rewards', {
        _addresses: [address],
        _epoch_no: null // get all epochs
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status !== 200) throw new Error(`Failed to fetch rewards history: ${response.status}`);
      
      const rewards = response.data as any[];
      
      return rewards
        .slice(0, limit)
        .map(reward => ({
          epoch: parseInt(reward.earned_epoch),
          amount: reward.amount,
          poolId: reward.pool_id,
          type: reward.type || 'member'
        }))
        .sort((a, b) => b.epoch - a.epoch); // Latest first
    } catch (error) {
      Logger.error('Failed to fetch rewards history', error as Error);
      return [];
    }
  }

  /**
   * Get staking activity history (registrations, delegations, withdrawals)
   */
  async getStakingActivity(address: string, limit: number = 50): Promise<StakingActivity[]> {
    try {
      const response = await axios.post('https://api.koios.rest/api/v1/account_history', {
        _addresses: [address],
        _after_block_height: 0
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status !== 200) throw new Error(`Failed to fetch staking activity: ${response.status}`);
      
      const activities = response.data as any[];
      
      return activities
        .filter(activity => activity.stake_cert) // Only staking-related transactions
        .slice(0, limit)
        .map(activity => ({
          txHash: activity.tx_hash,
          epoch: parseInt(activity.epoch_no),
          action: this.mapStakingAction(activity.stake_cert.type),
          poolId: activity.stake_cert.pool_id,
          amount: activity.stake_cert.amount,
          certIndex: activity.stake_cert.cert_index || 0
        }))
        .sort((a, b) => b.epoch - a.epoch); // Latest first
    } catch (error) {
      Logger.error('Failed to fetch staking activity', error as Error);
      return [];
    }
  }

  /**
   * Get top performing stake pools by various metrics
   */
  async getTopStakePools(metric: 'roa' | 'blocks' | 'stake' = 'roa', limit: number = 20): Promise<StakePool[]> {
    try {
      const pools = await this.getStakePools();
      
      // Filter out retired pools and sort by metric
      const activePools = pools.filter(pool => !pool.retired && pool.saturation < 1.0);
      
      switch (metric) {
        case 'roa':
          return activePools
            .sort((a, b) => b.roa - a.roa)
            .slice(0, limit);
        
        case 'blocks':
          return activePools
            .sort((a, b) => b.blocksLifetime - a.blocksLifetime)
            .slice(0, limit);
        
        case 'stake':
          return activePools
            .sort((a, b) => BigInt(b.liveStake) > BigInt(a.liveStake) ? 1 : -1)
            .slice(0, limit);
        
        default:
          return activePools.slice(0, limit);
      }
    } catch (error) {
      Logger.error('Failed to fetch top stake pools', error as Error);
      return [];
    }
  }

  /**
   * Calculate estimated staking rewards for an amount
   */
  calculateStakingRewards(amount: string, poolRoa: number, _epochsPerYear: number = 73): Amount<"ADA"> {
    const adaAmount = BigInt(amount);
    const yearlyRewards = (Number(adaAmount) * poolRoa) / 100;
    
    return {
      value: Math.floor(yearlyRewards).toString(),
      unit: "ADA"
    };
  }

  /**
   * Get current epoch information
   */
  async getCurrentEpoch(): Promise<{ epoch: number; slotInEpoch: number; slotsInEpoch: number; endTime: Date } | null> {
    try {
      const response = await axios.get('https://api.koios.rest/api/v1/tip');
      if (response.status !== 200) throw new Error(`Failed to fetch epoch info: ${response.status}`);
      
      const tip = response.data as any;
      
      return {
        epoch: parseInt(tip.epoch_no),
        slotInEpoch: parseInt(tip.epoch_slot),
        slotsInEpoch: 432000, // Standard Cardano epoch length
        endTime: new Date(tip.block_time)
      };
    } catch (error) {
      Logger.error('Failed to fetch current epoch', error as Error);
      return null;
    }
  }

  /**
   * Map raw staking certificate type to readable action
   */
  private mapStakingAction(certType: string): StakingActivity['action'] {
    switch (certType) {
      case 'stake_registration':
        return 'registration';
      case 'stake_delegation':
        return 'delegation';
      case 'stake_deregistration':
        return 'deregistration';
      case 'stake_withdrawal':
        return 'withdrawal';
      default:
        return 'delegation';
    }
  }
}