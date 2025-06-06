/**
 * Protocol Parameters Normalization Service
 * Handles inconsistencies between different API providers and TyphonJS requirements
 */

import BigNumber from 'bignumber.js';
import { types as TyphonTypes } from '@stricahq/typhonjs';
import { CARDANO_PROTOCOL_DEFAULTS } from '../types/domain';
import { Logger } from './logger';
import { ValidationError, ErrorCode } from '../errors/error-types';

/**
 * Raw protocol parameters from various API providers
 * Handles different naming conventions and formats
 */
export interface RawProtocolParams {
  // Koios API format
  min_fee_a?: string | number;
  min_fee_b?: string | number;
  max_tx_size?: string | number;
  utxo_cost_per_word?: string | number;
  coins_per_utxo_word?: string | number;
  pool_deposit?: string | number;
  key_deposit?: string | number;
  max_val_size?: string | number;
  price_mem?: string | number;
  price_step?: string | number;
  collateral_percent?: string | number;
  max_collateral_inputs?: string | number;
  
  // Blockfrost API format
  minFeeA?: string | number;
  minFeeB?: string | number;
  maxTxSize?: string | number;
  utxoCostPerWord?: string | number;
  poolDeposit?: string | number;
  keyDeposit?: string | number;
  maxValSize?: string | number;
  priceMem?: string | number;
  priceStep?: string | number;
  collateralPercent?: string | number;
  maxCollateralInputs?: string | number;
  
  // CardanoScan API format
  minUtxo?: string | number;
  minFee?: string | number;
  
  // Additional fields that might be present
  [key: string]: any;
}

/**
 * Protocol Parameters Normalization Service
 */
export class ProtocolParamsNormalizer {
  
  /**
   * Normalize raw protocol parameters to TyphonJS format
   * Handles multiple API providers and naming conventions
   */
  static normalize(rawParams: RawProtocolParams): TyphonTypes.ProtocolParams {
    try {
      Logger.debug('Normalizing protocol parameters', { 
        sourceFields: Object.keys(rawParams),
        provider: ProtocolParamsNormalizer.detectProvider(rawParams)
      });

      const normalized: TyphonTypes.ProtocolParams = {
        minFeeA: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['min_fee_a', 'minFeeA'],
          CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_A
        ),
        
        minFeeB: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['min_fee_b', 'minFeeB'],
          CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_B
        ),
        
        stakeKeyDeposit: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['key_deposit', 'keyDeposit', 'stakeKeyDeposit'],
          CARDANO_PROTOCOL_DEFAULTS.KEY_DEPOSIT
        ),
        
        lovelacePerUtxoWord: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['utxo_cost_per_word', 'coins_per_utxo_word', 'utxoCostPerWord', 'lovelacePerUtxoWord'],
          CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD
        ),
        
        utxoCostPerByte: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['utxo_cost_per_byte', 'utxoCostPerByte'],
          CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD // Use same default
        ),
        
        collateralPercent: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['collateral_percent', 'collateralPercent'],
          CARDANO_PROTOCOL_DEFAULTS.COLLATERAL_PERCENT
        ),
        
        priceSteps: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['price_step', 'priceStep', 'priceSteps'],
          CARDANO_PROTOCOL_DEFAULTS.PRICE_STEP,
          true // Convert to BigNumber even if it's a decimal
        ),
        
        priceMem: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['price_mem', 'priceMem'],
          CARDANO_PROTOCOL_DEFAULTS.PRICE_MEM,
          true // Convert to BigNumber even if it's a decimal
        ),
        
        maxTxSize: ProtocolParamsNormalizer.extractNumber(
          rawParams,
          ['max_tx_size', 'maxTxSize'],
          CARDANO_PROTOCOL_DEFAULTS.MAX_TX_SIZE
        ),
        
        maxValueSize: ProtocolParamsNormalizer.extractNumber(
          rawParams,
          ['max_val_size', 'maxValSize', 'maxValueSize'],
          CARDANO_PROTOCOL_DEFAULTS.MAX_VAL_SIZE
        ),
        
        minFeeRefScriptCostPerByte: ProtocolParamsNormalizer.extractBigNumber(
          rawParams,
          ['min_fee_ref_script_cost_per_byte', 'minFeeRefScriptCostPerByte'],
          15 // Standard reference script cost
        ),
        
        languageView: {
          PlutusScriptV1: rawParams.costModelsV1 || [],
          PlutusScriptV2: rawParams.costModelsV2 || [],
          PlutusScriptV3: rawParams.costModelsV3 || []
        }
      };

      // Validate the normalized parameters
      ProtocolParamsNormalizer.validateParameters(normalized);

      Logger.debug('Protocol parameters normalized successfully', {
        normalizedKeys: Object.keys(normalized),
        minFeeA: normalized.minFeeA.toString(),
        minFeeB: normalized.minFeeB.toString(),
        stakeKeyDeposit: normalized.stakeKeyDeposit.toString()
      });

      return normalized;
    } catch (error) {
      Logger.error('Failed to normalize protocol parameters', error as Error);
      
      // Return default parameters if normalization fails
      Logger.warn('Using default protocol parameters due to normalization failure');
      return ProtocolParamsNormalizer.getDefaultParameters();
    }
  }

  /**
   * Extract BigNumber value from multiple possible field names
   */
  private static extractBigNumber(
    params: RawProtocolParams,
    fieldNames: string[],
    defaultValue: string | number,
    allowDecimals: boolean = false
  ): BigNumber {
    for (const fieldName of fieldNames) {
      const value = params[fieldName];
      if (value !== undefined && value !== null) {
        try {
          const numValue = new BigNumber(value.toString());
          if (numValue.isNaN()) continue;
          
          // Validate for non-decimal fields
          if (!allowDecimals && !numValue.isInteger()) {
            Logger.warn(`Non-integer value found for ${fieldName}: ${value}, using default`);
            continue;
          }
          
          return numValue;
        } catch (error) {
          Logger.warn(`Invalid BigNumber value for ${fieldName}: ${value}`);
          continue;
        }
      }
    }
    
    return new BigNumber(defaultValue.toString());
  }

  /**
   * Extract number value from multiple possible field names
   */
  private static extractNumber(
    params: RawProtocolParams,
    fieldNames: string[],
    defaultValue: number
  ): number {
    for (const fieldName of fieldNames) {
      const value = params[fieldName];
      if (value !== undefined && value !== null) {
        const numValue = Number(value);
        if (!isNaN(numValue) && isFinite(numValue)) {
          return Math.floor(numValue); // Ensure integer
        }
      }
    }
    
    return defaultValue;
  }

  /**
   * Detect which API provider the parameters came from
   */
  private static detectProvider(params: RawProtocolParams): string {
    if (params.min_fee_a !== undefined) return 'Koios';
    if (params.minFeeA !== undefined) return 'Blockfrost';
    if (params.minUtxo !== undefined) return 'CardanoScan';
    return 'Unknown';
  }

  /**
   * Validate normalized parameters for reasonableness
   */
  private static validateParameters(params: TyphonTypes.ProtocolParams): void {
    const validations = [
      {
        condition: params.minFeeA.isGreaterThan(0),
        message: 'minFeeA must be positive'
      },
      {
        condition: params.minFeeB.isGreaterThan(0),
        message: 'minFeeB must be positive'
      },
      {
        condition: params.stakeKeyDeposit.isGreaterThanOrEqualTo(1000000), // At least 1 ADA
        message: 'stakeKeyDeposit must be at least 1 ADA'
      },
      {
        condition: params.lovelacePerUtxoWord.isGreaterThan(0),
        message: 'lovelacePerUtxoWord must be positive'
      },
      {
        condition: params.maxTxSize && params.maxTxSize > 1000, // At least 1KB
        message: 'maxTxSize must be at least 1000 bytes'
      },
      {
        condition: params.maxValueSize > 100,
        message: 'maxValueSize must be at least 100 bytes'
      },
      {
        condition: params.collateralPercent.isGreaterThan(100),
        message: 'collateralPercent must be greater than 100'
      }
    ];

    for (const validation of validations) {
      if (!validation.condition) {
        throw new ValidationError(
          ErrorCode.INVALID_INPUT,
          `Invalid protocol parameter: ${validation.message}`
        );
      }
    }
  }

  /**
   * Get default TyphonJS-compatible protocol parameters
   */
  private static getDefaultParameters(): TyphonTypes.ProtocolParams {
    return {
      minFeeA: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_A),
      minFeeB: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_B),
      stakeKeyDeposit: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.KEY_DEPOSIT),
      lovelacePerUtxoWord: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD),
      utxoCostPerByte: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD),
      collateralPercent: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.COLLATERAL_PERCENT),
      priceSteps: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.PRICE_STEP),
      priceMem: new BigNumber(CARDANO_PROTOCOL_DEFAULTS.PRICE_MEM),
      maxTxSize: CARDANO_PROTOCOL_DEFAULTS.MAX_TX_SIZE,
      maxValueSize: CARDANO_PROTOCOL_DEFAULTS.MAX_VAL_SIZE,
      minFeeRefScriptCostPerByte: new BigNumber(15),
      languageView: {
        PlutusScriptV1: [],
        PlutusScriptV2: [],
        PlutusScriptV3: []
      }
    };
  }

  /**
   * Convert TyphonJS parameters back to API format for debugging
   */
  static toDebugFormat(params: TyphonTypes.ProtocolParams): Record<string, any> {
    return {
      minFeeA: params.minFeeA.toString(),
      minFeeB: params.minFeeB.toString(),
      stakeKeyDeposit: params.stakeKeyDeposit.toString(),
      lovelacePerUtxoWord: params.lovelacePerUtxoWord.toString(),
      utxoCostPerByte: params.utxoCostPerByte.toString(),
      collateralPercent: params.collateralPercent.toString(),
      priceSteps: params.priceSteps.toString(),
      priceMem: params.priceMem.toString(),
      maxTxSize: params.maxTxSize,
      maxValueSize: params.maxValueSize,
      minFeeRefScriptCostPerByte: params.minFeeRefScriptCostPerByte.toString(),
      languageView: params.languageView
    };
  }
}