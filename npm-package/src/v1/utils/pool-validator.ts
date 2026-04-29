/**
 * Pool Validator - Validates stake pools for delegation operations
 * Provides pool status checking, performance validation, and risk assessment
 */

import { Logger } from './logger';
import { CardanoStakingExtensions } from '../protocol/staking-extensions';

export interface PoolValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  status: 'active' | 'retired' | 'saturated' | 'unknown';
  performanceScore?: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PoolStatus {
  active: boolean;
  retired: boolean;
  retirementEpoch?: number;
  saturation: number;
  blocks: number;
  roa: number;
}

export class PoolValidator {
  constructor(private stakingExtensions: CardanoStakingExtensions) {}

  /**
   * Quick validation for delegation operations
   * Returns list of warnings for immediate user feedback
   */
  async quickValidateForDelegation(poolId: string): Promise<string[]> {
    const warnings: string[] = [];
    
    try {
      Logger.debug('Quick validation for pool delegation', { poolId });
      
      const poolDetails = await this.stakingExtensions.getStakePoolDetails(poolId);
      if (!poolDetails) {
        warnings.push('Pool information not found - please verify pool ID');
        return warnings;
      }

      // Check if pool is retiring
      if (poolDetails.retired) {
        warnings.push('Pool is retired and not accepting new delegations');
      }

      // Check pool saturation
      if (poolDetails.saturation > 1.0) {
        warnings.push('Pool is oversaturated - rewards may be reduced');
      } else if (poolDetails.saturation > 0.9) {
        warnings.push('Pool is near saturation - consider monitoring');
      }

      // Check if pool has low pledge
      const pledgeAmount = BigInt(poolDetails.pledge);
      if (pledgeAmount < BigInt(100000000000)) { // Less than 100k ADA
        warnings.push('Pool has relatively low pledge amount');
      }

      Logger.debug('Pool quick validation completed', { poolId, warningCount: warnings.length });
      
    } catch (error) {
      Logger.error('Pool quick validation failed', error as Error);
      warnings.push('Unable to validate pool - network connectivity issues');
    }

    return warnings;
  }

  /**
   * Comprehensive pool validation with full analysis
   */
  async comprehensivePoolValidation(poolId: string): Promise<PoolValidationResult> {
    try {
      Logger.debug('Starting comprehensive pool validation', { poolId });
      
      const warnings: string[] = [];
      const errors: string[] = [];
      let isValid = true;
      let status: 'active' | 'retired' | 'saturated' | 'unknown' = 'unknown';
      let performanceScore = 0;
      let riskLevel: 'low' | 'medium' | 'high' = 'medium';

      const poolDetails = await this.stakingExtensions.getStakePoolDetails(poolId);
      if (!poolDetails) {
        errors.push('Pool not found or invalid pool ID');
        isValid = false;
        riskLevel = 'high';
        
        return {
          isValid,
          warnings,
          errors,
          status,
          riskLevel
        };
      }

      // Determine pool status
      if (poolDetails.retired) {
        status = 'retired';
        errors.push('Pool is retired and cannot accept new delegations');
        isValid = false;
        riskLevel = 'high';
      } else if (poolDetails.saturation > 1.0) {
        status = 'saturated';
        warnings.push('Pool is oversaturated - reduced rewards expected');
        riskLevel = 'medium';
      } else {
        status = 'active';
      }

      // Performance analysis
      const blocks = poolDetails.blocksEpoch || 0;
      const expectedBlocks = Number(BigInt(poolDetails.liveStake) / BigInt(1000000000)) * 0.05; // Simplified calculation
      
      if (blocks > 0) {
        performanceScore = Math.min(100, (blocks / expectedBlocks) * 100);
        
        if (performanceScore < 50) {
          warnings.push('Pool has below-average block production');
          riskLevel = 'medium';
        } else if (performanceScore > 80) {
          riskLevel = 'low';
        }
      }

      // Check pool fees
      if (poolDetails.margin > 0.05) { // 5%
        warnings.push('Pool has high margin (>5%)');
      }
      
      if (BigInt(poolDetails.fixedCost) > BigInt(500000000)) { // 500 ADA
        warnings.push('Pool has high fixed cost (>500 ADA)');
      }

      // Note: Pool age validation would require additional data not in the current interface
      // This could be enhanced with pool registration timestamp if available

      Logger.debug('Comprehensive pool validation completed', {
        poolId,
        status,
        performanceScore,
        riskLevel,
        warningCount: warnings.length,
        errorCount: errors.length
      });

      return {
        isValid,
        warnings,
        errors,
        status,
        performanceScore,
        riskLevel
      };
      
    } catch (error) {
      Logger.error('Comprehensive pool validation failed', error as Error);
      
      return {
        isValid: false,
        warnings: [],
        errors: ['Pool validation failed due to network or data issues'],
        status: 'unknown',
        riskLevel: 'high'
      };
    }
  }

  /**
   * Validate pool metadata hash
   */
  async validatePoolMetadata(poolId: string): Promise<boolean> {
    try {
      Logger.debug('Validating pool metadata', { poolId });
      
      const poolDetails = await this.stakingExtensions.getStakePoolDetails(poolId);
      if (!poolDetails?.metadata?.hash || !poolDetails?.metadata?.url) {
        Logger.warn(`Pool missing metadata information: ${poolId}`);
        return false;
      }

      // In a full implementation, this would:
      // 1. Fetch metadata from the URL
      // 2. Calculate hash of the metadata
      // 3. Compare with registered hash
      // For now, we just check that both fields exist
      
      const hasValidMetadata = poolDetails.metadata.hash.length === 64 && // 32 bytes hex
                              poolDetails.metadata.url.startsWith('http');
      
      Logger.debug('Pool metadata validation result', { poolId, hasValidMetadata });
      return hasValidMetadata;
      
    } catch (error) {
      Logger.error('Pool metadata validation failed', error as Error);
      return false;
    }
  }

  /**
   * Get current pool status
   */
  async checkPoolStatus(poolId: string): Promise<PoolStatus> {
    try {
      Logger.debug('Checking pool status', { poolId });
      
      const poolDetails = await this.stakingExtensions.getStakePoolDetails(poolId);
      if (!poolDetails) {
        return {
          active: false,
          retired: true,
          saturation: 0,
          blocks: 0,
          roa: 0
        };
      }

      const status: PoolStatus = {
        active: !poolDetails.retired,
        retired: poolDetails.retired || false,
        retirementEpoch: undefined, // Not available in current interface
        saturation: poolDetails.saturation,
        blocks: poolDetails.blocksEpoch || 0,
        roa: poolDetails.roa || 0
      };

      Logger.debug('Pool status retrieved', { poolId, status });
      return status;
      
    } catch (error) {
      Logger.error('Pool status check failed', error as Error);
      
      return {
        active: false,
        retired: true,
        saturation: 0,
        blocks: 0,
        roa: 0
      };
    }
  }
}