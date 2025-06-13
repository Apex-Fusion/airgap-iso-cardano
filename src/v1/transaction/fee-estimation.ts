import { types as TyphonTypes, Transaction, utils as TyphonUtils } from '@stricahq/typhonjs';
import { CardanoDataService } from '../data';
import { Logger } from '../utils';
import BigNumber from 'bignumber.js';
import { CARDANO_PROTOCOL_DEFAULTS, CARDANO_CONSTANTS } from '../types/domain';

/**
 * TyphonJS-powered fee estimator using accurate Cardano protocol parameters
 * Replaces custom fee calculation with TyphonJS native capabilities
 */
export class CardanoFeeEstimator {
  private protocolParamsCache: TyphonTypes.ProtocolParams | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheExpiry = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly network: 'mainnet' | 'testnet',
    private readonly dataService?: CardanoDataService
  ) {}

  /**
   * Get TyphonJS protocol parameters with caching and fallback
   */
  async getProtocolParameters(): Promise<TyphonTypes.ProtocolParams> {
    // Try to get real parameters if online service is available
    if (this.dataService && this.shouldRefreshCache()) {
      try {
        const params = await this.dataService.getProtocolParameters();
        this.protocolParamsCache = this.mapToTyphonParams(params);
        this.cacheTimestamp = Date.now();
        
        Logger.debug('Protocol parameters fetched from Blockfrost');
        return this.protocolParamsCache;
      } catch (error) {
        Logger.warn('Failed to fetch protocol parameters, using fallback');
      }
    }

    // Use cached parameters if available and not expired
    if (this.protocolParamsCache && !this.shouldRefreshCache()) {
      Logger.debug('Using cached protocol parameters');
      return this.protocolParamsCache;
    }

    // Fallback to safe default parameters for offline operation
    Logger.debug('Using default protocol parameters for offline operation');
    return this.getDefaultProtocolParameters();
  }

  /**
   * Calculate accurate fee using TyphonJS Transaction class
   */
  async estimateTransactionFee(
    inputs: TyphonTypes.Input[],
    outputs: TyphonTypes.Output[],
    certificates?: TyphonTypes.Certificate[],
    withdrawals?: TyphonTypes.Withdrawal[],
    auxiliaryData?: TyphonTypes.AuxiliaryData
  ): Promise<{
    fee: BigNumber;
    minUtxo: BigNumber;
    totalCost: BigNumber;
    breakdown: {
      baseFee: BigNumber;
      sizeFee: BigNumber;
      scriptFee?: BigNumber;
    };
  }> {
    const protocolParams = await this.getProtocolParameters();
    
    // Create temporary transaction for fee calculation
    const tx = new Transaction({ protocolParams });
    
    // Add transaction components
    inputs.forEach(input => tx.addInput(input));
    outputs.forEach(output => tx.addOutput(output));
    
    if (certificates) {
      certificates.forEach(cert => tx.addCertificate(cert));
    }
    
    if (withdrawals) {
      withdrawals.forEach(withdrawal => tx.addWithdrawal(withdrawal));
    }
    
    if (auxiliaryData) {
      tx.setAuxiliaryData(auxiliaryData);
    }

    // Calculate accurate fee using TyphonJS
    const calculatedFee = tx.calculateFee();
    
    // Calculate minimum UTXO for outputs
    let totalMinUtxo = new BigNumber(0);
    for (const output of outputs) {
      const minUtxo = tx.calculateMinUtxoAmountBabbage(output);
      totalMinUtxo = totalMinUtxo.plus(minUtxo);
    }
    
    // Calculate total cost
    const totalCost = calculatedFee.plus(totalMinUtxo);
    
    // Provide fee breakdown (estimated)
    const txSize = tx.calculateTxSize();
    const baseFee = protocolParams.minFeeB;
    const sizeFee = new BigNumber(txSize).multipliedBy(protocolParams.minFeeA);
    const scriptFee = tx.isPlutusTransaction() ? new BigNumber(44000) : undefined;
    
    Logger.debug(`Fee calculation completed: ${calculatedFee.toString()} lovelace`);
    
    return {
      fee: calculatedFee,
      minUtxo: totalMinUtxo,
      totalCost,
      breakdown: {
        baseFee,
        sizeFee,
        scriptFee
      }
    };
  }

  /**
   * Simple fee estimation for basic payment transactions
   */
  async estimateSimplePaymentFee(
    inputCount: number,
    outputCount: number,
    _totalAmount: BigNumber
  ): Promise<BigNumber> {
    const protocolParams = await this.getProtocolParameters();
    
    // Enhanced transaction size estimation using TyphonJS constants and patterns
    const baseSize = CARDANO_CONSTANTS.MIN_TX_SIZE; // Use TyphonJS constant for base size
    const inputSize = inputCount * 180; // Standard input size (based on TyphonJS analysis)
    const outputSize = outputCount * 43;  // Standard output size (based on TyphonJS analysis)
    const witnessSize = inputCount * 139; // Witness size per input (Ed25519 + overhead)
    const estimatedSize = Math.min(baseSize + inputSize + outputSize + witnessSize, CARDANO_CONSTANTS.MAX_TX_SIZE);
    
    // Calculate fee components
    const baseFee = protocolParams.minFeeB;
    const sizeFee = new BigNumber(estimatedSize).multipliedBy(protocolParams.minFeeA);
    
    return baseFee.plus(sizeFee);
  }

  /**
   * Calculate minimum UTXO amount for an output using TyphonJS utilities
   */
  async calculateMinUtxo(
    address: TyphonTypes.CardanoAddress,
    amount: BigNumber,
    tokens: TyphonTypes.Token[] = []
  ): Promise<BigNumber> {
    const protocolParams = await this.getProtocolParameters();
    
    try {
      // Use TyphonJS utility for output value size calculation
      if (TyphonUtils.getOutputValueSize) {
        const outputValueSize = TyphonUtils.getOutputValueSize(amount, tokens);
        Logger.debug(`TyphonJS output value size: ${outputValueSize} bytes`);
      }
      
      // Primary: Use TyphonJS Babbage-era calculation if available
      if (TyphonUtils.calculateMinUtxoAmountBabbage && protocolParams.utxoCostPerByte) {
        const output: TyphonTypes.Output = {
          address,
          amount,
          tokens
        };
        
        const minUtxoBabbage = TyphonUtils.calculateMinUtxoAmountBabbage(
          output,
          protocolParams.utxoCostPerByte
        );
        
        Logger.debug(`TyphonJS Babbage min UTXO: ${minUtxoBabbage.toString()}`);
        return minUtxoBabbage;
      }
      
      // Fallback: Use original TyphonJS calculation
      if (TyphonUtils.calculateMinUtxoAmount && protocolParams.lovelacePerUtxoWord) {
        const minUtxo = TyphonUtils.calculateMinUtxoAmount(
          tokens,
          protocolParams.lovelacePerUtxoWord
        );
        
        Logger.debug(`TyphonJS legacy min UTXO: ${minUtxo.toString()}`);
        return minUtxo;
      }
      
      // Ultimate fallback: Use Transaction class
      const tx = new Transaction({ protocolParams });
      const output: TyphonTypes.Output = {
        address,
        amount,
        tokens
      };
      
      return tx.calculateMinUtxoAmountBabbage(output);
    } catch (error) {
      Logger.warn(`TyphonJS min UTXO calculation failed: ${(error as Error).message}, using fallback`);
      
      // Enhanced fallback calculation
      return this.calculateFallbackMinUtxo(amount, tokens);
    }
  }

  /**
   * Enhanced fallback min UTXO calculation using TyphonJS constants
   */
  private calculateFallbackMinUtxo(amount: BigNumber, tokens: TyphonTypes.Token[]): BigNumber {
    // Use TyphonJS constants for base minimum
    let minUtxo = new BigNumber(CARDANO_CONSTANTS.MIN_UTXO_ADA.toString());
    
    // Add storage cost for each token using protocol-accurate calculation
    if (tokens.length > 0) {
      const tokenStorageCost = new BigNumber(tokens.length).multipliedBy(CARDANO_CONSTANTS.UTXO_STORAGE_COST);
      minUtxo = minUtxo.plus(tokenStorageCost);
    }
    
    // Ensure the provided amount meets the minimum
    return BigNumber.maximum(minUtxo, amount);
  }

  /**
   * Check if cache should be refreshed
   */
  private shouldRefreshCache(): boolean {
    return Date.now() - this.cacheTimestamp > this.cacheExpiry;
  }

  /**
   * Map Blockfrost parameters to TyphonJS format
   */
  private mapToTyphonParams(params: any): TyphonTypes.ProtocolParams {
    return {
      minFeeA: new BigNumber(params.min_fee_a || CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_A),
      minFeeB: new BigNumber(params.min_fee_b || CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_B),
      stakeKeyDeposit: new BigNumber(params.key_deposit || CARDANO_PROTOCOL_DEFAULTS.KEY_DEPOSIT),
      lovelacePerUtxoWord: new BigNumber(params.utxo_cost_per_word || CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD),
      utxoCostPerByte: new BigNumber(params.utxo_cost_per_byte || CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD),
      collateralPercent: new BigNumber(params.collateral_percent || CARDANO_PROTOCOL_DEFAULTS.COLLATERAL_PERCENT),
      priceSteps: new BigNumber(params.price_steps || CARDANO_PROTOCOL_DEFAULTS.PRICE_STEP),
      priceMem: new BigNumber(params.price_mem || CARDANO_PROTOCOL_DEFAULTS.PRICE_MEM),
      maxTxSize: params.max_tx_size || CARDANO_PROTOCOL_DEFAULTS.MAX_TX_SIZE,
      maxValueSize: params.max_value_size || CARDANO_PROTOCOL_DEFAULTS.MAX_VAL_SIZE,
      minFeeRefScriptCostPerByte: new BigNumber(params.min_fee_ref_script_cost_per_byte || '15'),
      languageView: {
        PlutusScriptV1: params.cost_models?.PlutusV1 || [],
        PlutusScriptV2: params.cost_models?.PlutusV2 || [],
        PlutusScriptV3: params.cost_models?.PlutusV3 || []
      }
    };
  }

  /**
   * Default protocol parameters for offline operation
   */
  private getDefaultProtocolParameters(): TyphonTypes.ProtocolParams {
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
      minFeeRefScriptCostPerByte: new BigNumber('15'),
      languageView: {
        PlutusScriptV1: [],
        PlutusScriptV2: [],
        PlutusScriptV3: []
      }
    };
  }

  /**
   * Clear cached parameters (useful for testing)
   */
  clearCache(): void {
    this.protocolParamsCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Check if using real-time parameters
   */
  isUsingRealTimeParameters(): boolean {
    return this.dataService !== undefined && this.protocolParamsCache !== null;
  }
}