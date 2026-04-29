/**
 * Comprehensive Input Validation System
 * Enhanced with TyphonJS integration for protocol-compliant validation
 */

import { Result, ResultUtils } from "./result";
import { utils as TyphonUtils, types as TyphonTypes, address as TyphonAddress } from '@stricahq/typhonjs';
import type { ProtocolParameters, TyphonProtocolParams } from '../types/domain';
import { CARDANO_CONSTANTS } from '../types/domain';
import { Logger } from './logger';
import BigNumber from 'bignumber.js';

// Basic validation interfaces
export interface ValidationSchema<T> {
  readonly name: string;
  validate(value: unknown): Result<T, ValidationError>;
}

export interface ValidationError {
  readonly field: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly value: any;
  readonly constraint: string;
  readonly message: string;
}

// Validation error implementation
export class CardanoValidationError extends Error implements ValidationError {
  constructor(
    public readonly field: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public readonly value: any,
    public readonly constraint: string,
    message?: string,
  ) {
    super(message || `Validation failed for field '${field}': ${constraint}`);
    this.name = "CardanoValidationError";
  }

  get message(): string {
    return super.message;
  }
}

// Basic validators
export class Validators {
  static string(
    options: {
      minLength?: number;
      maxLength?: number;
      pattern?: RegExp;
      allowEmpty?: boolean;
    } = {},
  ): ValidationSchema<string> {
    return {
      name: "string",
      validate: (value: unknown): Result<string, ValidationError> => {
        if (typeof value !== "string") {
          return ResultUtils.error(
            new CardanoValidationError("value", value, "must be a string"),
          );
        }

        if (!options.allowEmpty && value.length === 0) {
          return ResultUtils.error(
            new CardanoValidationError("value", value, "cannot be empty"),
          );
        }

        if (
          options.minLength !== undefined &&
          value.length < options.minLength
        ) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              `must be at least ${options.minLength} characters`,
            ),
          );
        }

        if (
          options.maxLength !== undefined &&
          value.length > options.maxLength
        ) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              `must be at most ${options.maxLength} characters`,
            ),
          );
        }

        if (options.pattern && !options.pattern.test(value)) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              `must match pattern ${options.pattern}`,
            ),
          );
        }

        return ResultUtils.ok(value);
      },
    };
  }

  static number(
    options: {
      min?: number;
      max?: number;
      integer?: boolean;
    } = {},
  ): ValidationSchema<number> {
    return {
      name: "number",
      validate: (value: unknown): Result<number, ValidationError> => {
        if (typeof value !== "number" || isNaN(value)) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              "must be a valid number",
            ),
          );
        }

        if (options.integer && !Number.isInteger(value)) {
          return ResultUtils.error(
            new CardanoValidationError("value", value, "must be an integer"),
          );
        }

        if (options.min !== undefined && value < options.min) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              `must be at least ${options.min}`,
            ),
          );
        }

        if (options.max !== undefined && value > options.max) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              `must be at most ${options.max}`,
            ),
          );
        }

        return ResultUtils.ok(value);
      },
    };
  }

  static hexString(
    options: {
      length?: number;
      minLength?: number;
      maxLength?: number;
    } = {},
  ): ValidationSchema<string> {
    return {
      name: "hexString",
      validate: (value: unknown): Result<string, ValidationError> => {
        const stringResult = Validators.string({
          minLength: options.minLength,
          maxLength: options.maxLength,
        }).validate(value);

        if (!stringResult.success) {
          return stringResult;
        }

        const str = stringResult.data;

        if (!/^[0-9a-fA-F]*$/.test(str)) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              "must contain only hexadecimal characters",
            ),
          );
        }

        if (options.length !== undefined && str.length !== options.length) {
          return ResultUtils.error(
            new CardanoValidationError(
              "value",
              value,
              `must be exactly ${options.length} characters`,
            ),
          );
        }

        return ResultUtils.ok(str);
      },
    };
  }

  // TyphonJS-enhanced Cardano-specific validators
  static cardanoAddress(options: { 
    network?: 'mainnet' | 'testnet'; 
    type?: 'base' | 'enterprise' | 'reward' | 'pointer';
    allowByron?: boolean;
  } = {}): ValidationSchema<string> {
    return {
      name: "cardanoAddress",
      validate: (value: unknown): Result<string, ValidationError> => {
        const stringResult = Validators.string({ allowEmpty: false }).validate(value);
        if (!stringResult.success) {
          return stringResult;
        }

        const address = stringResult.data;
        
        try {
          // Use TyphonJS for official Cardano address validation
          const parsedAddress = TyphonUtils.getAddressFromString(address);
          if (!parsedAddress) {
            return ResultUtils.error(
              new CardanoValidationError(
                "address",
                value,
                "invalid Cardano address format",
              ),
            );
          }
          
          // Enhanced validation using TyphonJS address type checking
          if (options.network) {
            try {
              const addressNetwork = this.getAddressNetworkId(parsedAddress);
              const expectedNetwork = options.network === 'mainnet' ? 
                TyphonTypes.NetworkId.MAINNET : TyphonTypes.NetworkId.TESTNET;
              
              if (addressNetwork !== expectedNetwork) {
                return ResultUtils.error(
                  new CardanoValidationError(
                    "address",
                    value,
                    `address is for ${options.network === 'mainnet' ? 'testnet' : 'mainnet'} but expected ${options.network}`,
                  ),
                );
              }
            } catch (networkError) {
              Logger.warn(`Address network validation failed: ${(networkError as Error).message}`);
            }
          }
          
          // Enhanced address type validation using TyphonJS
          if (options.type) {
            const addressType = this.getAddressType(parsedAddress);
            if (addressType !== options.type) {
              return ResultUtils.error(
                new CardanoValidationError(
                  "address",
                  value,
                  `address type is ${addressType} but expected ${options.type}`,
                ),
              );
            }
          }
          
          // Byron address handling
          if (!options.allowByron && this.isByronAddress(parsedAddress)) {
            return ResultUtils.error(
              new CardanoValidationError(
                "address",
                value,
                "Byron addresses are not supported in this context",
              ),
            );
          }
          
          return ResultUtils.ok(address);
        } catch (error) {
          return ResultUtils.error(
            new CardanoValidationError(
              "address",
              value,
              `invalid Cardano address: ${(error as Error).message}`,
            ),
          );
        }
      },
    };
  }

  /**
   * Get address network ID using TyphonJS
   */
  private static getAddressNetworkId(address: TyphonTypes.CardanoAddress): TyphonTypes.NetworkId {
    // For Shelley-era addresses, network ID is available
    if ('getNetworkId' in address && typeof address.getNetworkId === 'function') {
      return address.getNetworkId();
    }
    
    // For Byron addresses, determine network from prefix using TyphonJS constants
    const addressStr = address.getBech32();
    if (addressStr.startsWith(CARDANO_CONSTANTS.BECH32_ADDR_PREFIX_TESTNET) || 
        addressStr.startsWith(CARDANO_CONSTANTS.BECH32_STAKE_PREFIX_TESTNET)) {
      return TyphonTypes.NetworkId.TESTNET;
    }
    
    return TyphonTypes.NetworkId.MAINNET;
  }

  /**
   * Get address type using TyphonJS address classes
   */
  private static getAddressType(address: TyphonTypes.CardanoAddress): string {
    try {
      // Use TyphonJS address classes for type checking
      if (address instanceof TyphonAddress.BaseAddress) return 'base';
      if (address instanceof TyphonAddress.EnterpriseAddress) return 'enterprise';
      if (address instanceof TyphonAddress.RewardAddress) return 'reward';
      if (address instanceof TyphonAddress.PointerAddress) return 'pointer';
      if (address instanceof TyphonAddress.ByronAddress) return 'byron';
      
      return 'unknown';
    } catch (error) {
      Logger.warn(`Address type detection failed: ${(error as Error).message}`);
      return 'unknown';
    }
  }

  /**
   * Check if address is Byron type using TyphonJS
   */
  private static isByronAddress(address: TyphonTypes.CardanoAddress): boolean {
    try {
      return address instanceof TyphonAddress.ByronAddress;
    } catch (error) {
      Logger.warn(`Byron address check failed: ${(error as Error).message}`);
      return false;
    }
  }

  static ada(options: { min?: bigint; max?: bigint } = {}): ValidationSchema<bigint> {
    return {
      name: "ada",
      validate: (value: unknown): Result<bigint, ValidationError> => {
        let amount: bigint;
        
        try {
          if (typeof value === 'bigint') {
            amount = value;
          } else if (typeof value === 'number') {
            amount = BigInt(value);
          } else if (typeof value === 'string') {
            amount = BigInt(value);
          } else {
            throw new Error('Invalid type');
          }
        } catch {
          return ResultUtils.error(
            new CardanoValidationError(
              "amount",
              value,
              "must be a valid ADA amount (bigint, number, or string)",
            ),
          );
        }

        if (amount < 0n) {
          return ResultUtils.error(
            new CardanoValidationError(
              "amount",
              value,
              "ADA amount cannot be negative",
            ),
          );
        }

        if (options.min !== undefined && amount < options.min) {
          return ResultUtils.error(
            new CardanoValidationError(
              "amount",
              value,
              `ADA amount must be at least ${options.min} lovelace`,
            ),
          );
        }

        if (options.max !== undefined && amount > options.max) {
          return ResultUtils.error(
            new CardanoValidationError(
              "amount",
              value,
              `ADA amount must be at most ${options.max} lovelace`,
            ),
          );
        }

        return ResultUtils.ok(amount);
      },
    };
  }

  static txHash(): ValidationSchema<string> {
    return Validators.hexString({ length: 64 });
  }

  static publicKey(): ValidationSchema<string> {
    return Validators.hexString({ length: 64 });
  }

  static signature(): ValidationSchema<string> {
    return Validators.hexString({ length: 128 });
  }

  static policyId(): ValidationSchema<string> {
    return Validators.hexString({ length: 56 });
  }

  static assetName(): ValidationSchema<string> {
    return Validators.hexString({ maxLength: 64 });
  }
}

// TyphonJS-enhanced validation utilities
export class TyphonValidators {
  /**
   * Validate minimum UTXO amount using TyphonJS calculations
   */
  static validateMinUtxo(
    address: string,
    amount: bigint,
    assets?: Map<string, Map<string, bigint>>,
    protocolParams?: TyphonProtocolParams
  ): Result<boolean, ValidationError> {
    try {
      if (!protocolParams) {
        // Use default if not provided
        return ResultUtils.ok(amount >= 1000000n); // 1 ADA minimum fallback
      }

      // Use TyphonJS for accurate minimum UTXO calculation
      // Note: TyphonJS calculateMinUtxoAmountBabbage expects a proper output object
      const addressObj = TyphonUtils.getAddressFromString(address);
      
      if (!addressObj) {
        throw new Error('Invalid address format');
      }
      
      const outputForCalculation = {
        address: addressObj,
        amount: new BigNumber(amount.toString()),
        tokens: assets ? Array.from(assets.entries()).map(([policy, assetMap]) => 
          Array.from(assetMap.entries()).map(([name, qty]) => ({
            policyId: policy,
            assetName: name,
            amount: new BigNumber(qty.toString())
          }))
        ).flat() : []
      };
      
      const minAmount = TyphonUtils.calculateMinUtxoAmountBabbage(
        outputForCalculation,
        new BigNumber(protocolParams.coinsPerUtxoWord)
      );

      // Convert BigNumber to bigint for comparison
      const minAmountBigInt = BigInt(minAmount.toString());

      if (amount < minAmountBigInt) {
        return ResultUtils.error(
          new CardanoValidationError(
            "amount",
            amount,
            `minimum UTXO requirement not met: need ${minAmountBigInt} lovelace, got ${amount}`,
          ),
        );
      }

      return ResultUtils.ok(true);
    } catch (error) {
      return ResultUtils.error(
        new CardanoValidationError(
          "utxo",
          { address, amount, assets },
          `UTXO validation failed: ${(error as Error).message}`,
        ),
      );
    }
  }

  /**
   * Convert standard protocol parameters to TyphonJS format
   */
  static convertProtocolParams(params: ProtocolParameters): TyphonProtocolParams {
    return {
      minFeeA: params.minFeeA,
      minFeeB: params.minFeeB,
      maxTxSize: params.maxTxSize,
      coinsPerUtxoWord: params.coinsPerUtxoWord || Number(params.utxoCostPerWord),
      poolDeposit: params.poolDeposit,
      keyDeposit: params.keyDeposit,
      maxValSize: params.maxValSize,
      maxCollateralInputs: params.maxCollateralInputs || 3,
      collateralPercent: params.collateralPercent || 150,
      priceMem: params.priceMem || 0.0577,
      priceStep: params.priceStep || 0.0000721,
    };
  }
}
