/**
 * TyphonJS-powered transaction builder for Cardano
 * Replaces custom implementation with production-ready TyphonJS Transaction class
 */

import { Transaction, types as TyphonTypes, utils as TyphonUtils } from '@stricahq/typhonjs';
import { sortTokens } from '@stricahq/typhonjs/dist/utils/helpers';
import { CARDANO_CONSTANTS } from '../types/domain';
import { UTXO } from './utxo-selector';
import { Logger } from '../utils';
import { 
  TransactionBuildError, 
  ValidationError, 
  ErrorCode 
} from '../errors/error-types';
import BigNumber from 'bignumber.js';

// Input interfaces for compatibility with existing code
export interface TransactionOutput {
  address: string;
  amount: bigint;
  assets?: Map<string, bigint>; // Native tokens
}

export interface TransactionBuildRequest {
  outputs: TransactionOutput[];
  changeAddress: string;
  metadata?: any;
  ttl?: number;
  certificates?: TyphonTypes.Certificate[];
  withdrawals?: TyphonTypes.Withdrawal[];
}

export interface BuiltTransaction {
  transaction: Transaction;
  transactionCbor: string;
  transactionHash: string;
  fee: BigNumber;
  inputs: TyphonTypes.Input[];
  outputs: TyphonTypes.Output[];
  changeOutput?: TyphonTypes.Output;
  metadata?: TyphonTypes.AuxiliaryData;
}

/**
 * TyphonJS-powered Cardano transaction builder
 * Uses TyphonJS Transaction class for accurate Cardano protocol compliance
 */
export class TyphonTransactionBuilder {
  private protocolParams: TyphonTypes.ProtocolParams;

  constructor(protocolParams: TyphonTypes.ProtocolParams) {
    this.protocolParams = protocolParams;
    Logger.debug('TyphonJS transaction builder initialized');
  }

  /**
   * Build a transaction using TyphonJS automatic UTXO selection
   * TyphonJS Transaction.paymentTransaction() handles optimal UTXO selection
   */
  async buildTransactionWithAutoSelection(
    availableUtxos: UTXO[],
    buildRequest: TransactionBuildRequest
  ): Promise<BuiltTransaction> {
    try {
      Logger.debug('Building transaction with TyphonJS automatic UTXO selection', {
        outputCount: buildRequest.outputs.length,
        availableUtxoCount: availableUtxos.length,
      });

      // Validate inputs
      this.validateBuildRequest(buildRequest);
      this.validateUtxos(availableUtxos);

      // Convert available UTXOs to TyphonJS Input format
      const typhonInputs = this.convertUtxosToInputs(availableUtxos);
      
      // Convert outputs to TyphonJS format
      const typhonOutputs = this.convertOutputsToTyphon(buildRequest.outputs);
      
      // Convert change address to TyphonJS format
      const changeAddress = TyphonUtils.getAddressFromString(buildRequest.changeAddress);
      if (!changeAddress) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, `Invalid change address: ${buildRequest.changeAddress}`);
      }

      // Create TyphonJS Transaction with automatic UTXO selection
      const tx = new Transaction({ protocolParams: this.protocolParams });
      
      // Use TyphonJS paymentTransaction for automatic UTXO selection and fee calculation
      const paymentConfig: any = {
        inputs: typhonInputs,  // Available UTXOs for selection
        outputs: typhonOutputs,
        changeAddress: changeAddress as TyphonTypes.ShelleyAddress,
        metadata: buildRequest.metadata ? this.convertMetadataToAuxiliaryData(buildRequest.metadata) : undefined,
        certificates: buildRequest.certificates || [],
        withdrawals: buildRequest.withdrawals || []
      };
      
      if (buildRequest.ttl) {
        paymentConfig.ttl = buildRequest.ttl;
      }
      
      const finalTx = tx.paymentTransaction(paymentConfig);

      const { hash, payload } = finalTx.buildTransaction();
      
      // Extract transaction details
      const finalInputs = finalTx.getInputs();
      const finalOutputs = finalTx.getOutputs();
      const calculatedFee = finalTx.getFee();
      
      // Find change output (TyphonJS automatically creates change output if needed)
      const changeOutput = finalOutputs.find(output => 
        output.address.getBech32() === buildRequest.changeAddress
      );

      Logger.debug('Transaction built with TyphonJS auto-selection', {
        selectedInputs: finalInputs.length,
        outputCount: finalOutputs.length,
        fee: calculatedFee.toString(),
        hasChange: !!changeOutput
      });

      const builtTransaction: BuiltTransaction = {
        transaction: finalTx,
        transactionCbor: payload,
        transactionHash: hash,
        fee: calculatedFee,
        inputs: finalInputs,
        outputs: finalOutputs,
        changeOutput,
        metadata: buildRequest.metadata ? this.convertMetadataToAuxiliaryData(buildRequest.metadata) : undefined
      };

      return builtTransaction;
    } catch (error) {
      Logger.error('TyphonJS auto-selection transaction build failed', error as Error);
      throw new TransactionBuildError(
        ErrorCode.TRANSACTION_BUILD_FAILED,
        `Failed to build transaction with TyphonJS auto-selection: ${(error as Error).message}`,
        { outputCount: buildRequest.outputs.length, inputCount: availableUtxos.length }
      );
    }
  }

  /**
   * Build a transaction using pre-selected UTXOs (legacy method for compatibility)
   * Use buildTransactionWithAutoSelection() for optimal UTXO selection
   */
  async buildTransaction(
    availableUtxos: UTXO[],
    buildRequest: TransactionBuildRequest
  ): Promise<BuiltTransaction> {
    try {
      Logger.debug('Building transaction with TyphonJS', {
        outputCount: buildRequest.outputs.length,
        utxoCount: availableUtxos.length,
      });

      // Validate inputs
      this.validateBuildRequest(buildRequest);
      this.validateUtxos(availableUtxos);

      // Convert UTXOs to TyphonJS Input format
      const typhonInputs = this.convertUtxosToInputs(availableUtxos);
      
      // Convert outputs to TyphonJS format
      const typhonOutputs = this.convertOutputsToTyphon(buildRequest.outputs);
      
      // Convert change address to TyphonJS format
      const changeAddress = TyphonUtils.getAddressFromString(buildRequest.changeAddress);
      if (!changeAddress) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Invalid change address format');
      }

      // Create TyphonJS transaction
      const tx = new Transaction({ protocolParams: this.protocolParams });

      // Set TTL if provided
      if (buildRequest.ttl) {
        tx.setTTL(buildRequest.ttl);
      }

      // Add certificates if provided
      if (buildRequest.certificates) {
        buildRequest.certificates.forEach(cert => tx.addCertificate(cert));
      }

      // Add withdrawals if provided
      if (buildRequest.withdrawals) {
        buildRequest.withdrawals.forEach(withdrawal => tx.addWithdrawal(withdrawal));
      }

      // Add metadata if provided
      if (buildRequest.metadata) {
        const auxiliaryData = this.convertMetadataToAuxiliaryData(buildRequest.metadata);
        tx.setAuxiliaryData(auxiliaryData);
      }

      // Use TyphonJS payment transaction helper for optimal UTXO selection and change handling
      const finalTx = tx.paymentTransaction({
        inputs: typhonInputs,
        outputs: typhonOutputs,
        changeAddress,
        auxiliaryData: buildRequest.metadata ? this.convertMetadataToAuxiliaryData(buildRequest.metadata) : undefined,
        ttl: buildRequest.ttl || this.getDefaultTtl()
      });

      // Build the final transaction
      const { hash, payload } = finalTx.buildTransaction();
      
      // Extract transaction details
      const finalInputs = finalTx.getInputs();
      const finalOutputs = finalTx.getOutputs();
      const calculatedFee = finalTx.getFee();
      
      // Find change output (last output that goes to change address)
      const changeOutput = finalOutputs.find(output => 
        output.address.getBech32() === buildRequest.changeAddress
      );

      const builtTransaction: BuiltTransaction = {
        transaction: finalTx,
        transactionCbor: payload,
        transactionHash: hash,
        fee: calculatedFee,
        inputs: finalInputs,
        outputs: finalOutputs,
        changeOutput,
        metadata: buildRequest.metadata ? this.convertMetadataToAuxiliaryData(buildRequest.metadata) : undefined
      };

      Logger.debug('Transaction built successfully with TyphonJS', {
        hash,
        fee: calculatedFee.toString(),
        inputCount: finalInputs.length,
        outputCount: finalOutputs.length,
      });

      return builtTransaction;
    } catch (error) {
      Logger.error('TyphonJS transaction build failed', error as Error);
      
      if (error instanceof TransactionBuildError || error instanceof ValidationError) {
        throw error;
      }
      
      throw new TransactionBuildError(
        ErrorCode.TRANSACTION_BUILD_FAILED,
        `Failed to build transaction with TyphonJS: ${(error as Error).message}`
      );
    }
  }

  /**
   * Build a simple payment transaction
   */
  async buildSimplePayment(
    availableUtxos: UTXO[],
    recipient: string,
    amount: BigNumber,
    changeAddress: string,
    ttl?: number
  ): Promise<BuiltTransaction> {
    const recipientAddress = TyphonUtils.getAddressFromString(recipient);
    if (!recipientAddress) {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Invalid recipient address');
    }

    const outputs: TyphonTypes.Output[] = [{
      address: recipientAddress,
      amount,
      tokens: []
    }];

    const typhonInputs = this.convertUtxosToInputs(availableUtxos);
    const typhonChangeAddress = TyphonUtils.getAddressFromString(changeAddress);
    
    if (!typhonChangeAddress) {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Invalid change address');
    }

    const tx = new Transaction({ protocolParams: this.protocolParams });
    
    const finalTx = tx.paymentTransaction({
      inputs: typhonInputs,
      outputs,
      changeAddress: typhonChangeAddress,
      ttl: ttl || this.getDefaultTtl()
    });

    const { hash, payload } = finalTx.buildTransaction();

    return {
      transaction: finalTx,
      transactionCbor: payload,
      transactionHash: hash,
      fee: finalTx.getFee(),
      inputs: finalTx.getInputs(),
      outputs: finalTx.getOutputs(),
      changeOutput: finalTx.getOutputs().find(output => 
        output.address.getBech32() === changeAddress
      )
    };
  }

  /**
   * Build a staking transaction with automatic UTXO selection
   */
  async buildStakingTransactionWithAutoSelection(
    availableUtxos: UTXO[],
    certificates: TyphonTypes.Certificate[],
    changeAddress: string,
    withdrawals?: TyphonTypes.Withdrawal[],
    ttl?: number
  ): Promise<BuiltTransaction> {
    const typhonInputs = this.convertUtxosToInputs(availableUtxos);
    const typhonChangeAddress = TyphonUtils.getAddressFromString(changeAddress);
    
    if (!typhonChangeAddress) {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Invalid change address');
    }

    // Use TyphonJS paymentTransaction for automatic UTXO selection in staking transactions
    const tx = new Transaction({ protocolParams: this.protocolParams });
    const stakingConfig: any = {
      inputs: typhonInputs,
      outputs: [], // No payment outputs for pure staking transactions
      changeAddress: typhonChangeAddress as TyphonTypes.ShelleyAddress,
      certificates,
      withdrawals: withdrawals || []
    };
    
    if (ttl) {
      stakingConfig.ttl = ttl;
    }
    
    const finalTx = tx.paymentTransaction(stakingConfig);

    const { hash, payload } = finalTx.buildTransaction();

    Logger.debug('Staking transaction built with TyphonJS auto-selection', {
      selectedInputs: finalTx.getInputs().length,
      certificates: certificates.length,
      withdrawals: withdrawals?.length || 0,
      fee: finalTx.getFee().toString()
    });

    return {
      transaction: finalTx,
      transactionCbor: payload,
      transactionHash: hash,
      fee: finalTx.getFee(),
      inputs: finalTx.getInputs(),
      outputs: finalTx.getOutputs(),
      changeOutput: finalTx.getOutputs().find(output => 
        output.address.getBech32() === changeAddress
      )
    };
  }

  /**
   * Build a staking transaction (legacy method for compatibility)
   */
  async buildStakingTransaction(
    availableUtxos: UTXO[],
    certificates: TyphonTypes.Certificate[],
    changeAddress: string,
    withdrawals?: TyphonTypes.Withdrawal[],
    ttl?: number
  ): Promise<BuiltTransaction> {
    const typhonInputs = this.convertUtxosToInputs(availableUtxos);
    const typhonChangeAddress = TyphonUtils.getAddressFromString(changeAddress);
    
    if (!typhonChangeAddress) {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Invalid change address');
    }

    const tx = new Transaction({ protocolParams: this.protocolParams });
    
    // Add certificates
    certificates.forEach(cert => tx.addCertificate(cert));
    
    // Add withdrawals if provided
    if (withdrawals) {
      withdrawals.forEach(withdrawal => tx.addWithdrawal(withdrawal));
    }
    
    // Set TTL
    if (ttl) {
      tx.setTTL(ttl);
    }

    // Use transaction builder helper
    const finalTx = tx.prepareTransaction({
      inputs: typhonInputs,
      changeAddress: typhonChangeAddress
    });

    const { hash, payload } = finalTx.buildTransaction();

    return {
      transaction: finalTx,
      transactionCbor: payload,
      transactionHash: hash,
      fee: finalTx.getFee(),
      inputs: finalTx.getInputs(),
      outputs: finalTx.getOutputs(),
      changeOutput: finalTx.getOutputs().find(output => 
        output.address.getBech32() === changeAddress
      )
    };
  }

  /**
   * Convert UTXOs to TyphonJS Input format
   */
  private convertUtxosToInputs(utxos: UTXO[]): TyphonTypes.Input[] {
    return utxos.map(utxo => {
      const address = TyphonUtils.getAddressFromString(utxo.address);
      if (!address) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, `Invalid UTXO address: ${utxo.address}`);
      }

      const tokens = utxo.assets ? this.convertAssetsToTokens(utxo.assets) : [];

      return {
        txId: utxo.txHash,
        index: utxo.outputIndex,
        amount: new BigNumber(utxo.amount.toString()),
        tokens,
        address: address as TyphonTypes.ShelleyAddress
      };
    });
  }

  /**
   * Convert our output format to TyphonJS format with min UTXO validation
   */
  private convertOutputsToTyphon(outputs: TransactionOutput[]): TyphonTypes.Output[] {
    return outputs.map(output => {
      const address = TyphonUtils.getAddressFromString(output.address);
      if (!address) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, `Invalid output address: ${output.address}`);
      }

      const tokens = output.assets ? this.convertAssetsToTokens(output.assets) : [];
      const amount = new BigNumber(output.amount.toString());

      // Enhanced UTXO validation using TyphonJS utilities
      this.validateMinUtxoAmount(amount, tokens, output);

      return {
        address,
        amount,
        tokens
      };
    });
  }

  /**
   * Validate minimum UTXO amount using standardized TyphonJS Babbage calculation
   */
  private validateMinUtxoAmount(amount: BigNumber, tokens: TyphonTypes.Token[], output: TransactionOutput): void {
    try {
      const typhonOutput: TyphonTypes.Output = {
        address: TyphonUtils.getAddressFromString(output.address)!,
        amount,
        tokens
      };

      let minUtxo: BigNumber;
      
      // Prioritize Babbage era calculation (current Cardano protocol)
      if (TyphonUtils.calculateMinUtxoAmountBabbage && this.protocolParams.utxoCostPerByte) {
        minUtxo = TyphonUtils.calculateMinUtxoAmountBabbage(
          typhonOutput,
          this.protocolParams.utxoCostPerByte
        );
        
        Logger.debug('Using TyphonJS Babbage min UTXO calculation', {
          amount: amount.toString(),
          minUtxo: minUtxo.toString(),
          tokenCount: tokens.length
        });
      }
      // Fallback to legacy calculation for compatibility
      else if (TyphonUtils.calculateMinUtxoAmount && this.protocolParams.lovelacePerUtxoWord) {
        minUtxo = TyphonUtils.calculateMinUtxoAmount(
          tokens, 
          this.protocolParams.lovelacePerUtxoWord
        );
        
        Logger.debug('Using TyphonJS legacy min UTXO calculation', {
          amount: amount.toString(),
          minUtxo: minUtxo.toString(),
          tokenCount: tokens.length
        });
      }
      else {
        // Should not happen with proper protocol parameters
        throw new ValidationError(
          ErrorCode.INVALID_INPUT,
          'Protocol parameters missing required min UTXO calculation fields'
        );
      }
      
      if (amount.isLessThan(minUtxo)) {
        throw new ValidationError(
          ErrorCode.INVALID_AMOUNT,
          `Output amount ${amount.toString()} is below minimum UTXO requirement ${minUtxo.toString()}`,
          { 
            field: 'amount',
            value: amount.toString(),
            required: minUtxo.toString(), 
            provided: amount.toString()
          }
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      // Fallback to basic validation if TyphonJS utilities fail
      Logger.warn(`TyphonJS min UTXO validation failed: ${(error as Error).message}, using basic validation`);
      this.validateBasicMinUtxo(amount, tokens);
    }
  }

  /**
   * Fallback basic minimum UTXO validation using TyphonJS constants
   */
  private validateBasicMinUtxo(amount: BigNumber, tokens: TyphonTypes.Token[]): void {
    // Use TyphonJS constants for minimum UTXO calculation
    const basicMinUtxo = new BigNumber(CARDANO_CONSTANTS.MIN_UTXO_ADA.toString());
    
    // Add storage cost for tokens
    if (tokens.length > 0) {
      const tokenStorageCost = new BigNumber(tokens.length).multipliedBy(CARDANO_CONSTANTS.UTXO_STORAGE_COST);
      const totalMinUtxo = basicMinUtxo.plus(tokenStorageCost);
      
      if (amount.isLessThan(totalMinUtxo)) {
        throw new ValidationError(
          ErrorCode.INVALID_AMOUNT,
          `Output amount ${amount.toString()} is below minimum UTXO requirement ${totalMinUtxo.toString()} (${basicMinUtxo.toString()} base + ${tokenStorageCost.toString()} token storage)`,
          { required: totalMinUtxo.toString(), provided: amount.toString() }
        );
      }
    } else if (amount.isLessThan(basicMinUtxo)) {
      throw new ValidationError(
        ErrorCode.INVALID_AMOUNT,
        `Output amount ${amount.toString()} is below basic minimum UTXO requirement ${basicMinUtxo.toString()}`,
        { required: basicMinUtxo.toString(), provided: amount.toString() }
      );
    }
  }

  /**
   * Convert asset map to TyphonJS Token format with enhanced validation
   */
  private convertAssetsToTokens(assets: Map<string, bigint>): TyphonTypes.Token[] {
    const tokens: TyphonTypes.Token[] = [];
    
    for (const [assetId, amount] of assets) {
      // Validate asset ID format before parsing
      this.validateAssetId(assetId);
      
      // Parse asset ID using TyphonJS constants: policy_id + asset_name 
      const policyId = assetId.substring(0, CARDANO_CONSTANTS.POLICY_ID_LENGTH);
      const assetName = assetId.substring(CARDANO_CONSTANTS.POLICY_ID_LENGTH);
      
      tokens.push({
        policyId,
        assetName,
        amount: new BigNumber(amount.toString())
      });
    }
    
    // Use TyphonJS utility to sort tokens for consistent ordering
    // This ensures deterministic transaction building
    return this.sortTokensForConsistency(tokens);
  }

  /**
   * Validate asset ID format according to Cardano standards using TyphonJS constants
   */
  private validateAssetId(assetId: string): void {
    if (!assetId || typeof assetId !== 'string') {
      throw new ValidationError(ErrorCode.INVALID_ASSET, 'Asset ID must be a non-empty string');
    }
    
    if (assetId.length < CARDANO_CONSTANTS.POLICY_ID_LENGTH) {
      throw new ValidationError(
        ErrorCode.INVALID_ASSET, 
        `Asset ID too short - must contain at least policy ID (${CARDANO_CONSTANTS.POLICY_ID_LENGTH} hex chars)`
      );
    }
    
    const maxLength = CARDANO_CONSTANTS.POLICY_ID_LENGTH + CARDANO_CONSTANTS.MAX_ASSET_NAME_LENGTH;
    if (assetId.length > maxLength) {
      throw new ValidationError(
        ErrorCode.INVALID_ASSET, 
        `Asset ID too long - exceeds maximum length (${maxLength} chars)`
      );
    }
    
    if (!/^[0-9a-fA-F]+$/.test(assetId)) {
      throw new ValidationError(ErrorCode.INVALID_ASSET, 'Asset ID must be valid hexadecimal string');
    }
  }

  /**
   * Sort tokens for consistent transaction building using TyphonJS utility
   */
  private sortTokensForConsistency(tokens: TyphonTypes.Token[]): TyphonTypes.Token[] {
    // Use TyphonJS built-in sortTokens utility for canonical ordering
    // This ensures compatibility with TyphonJS internal transaction building
    return sortTokens(tokens);
  }

  /**
   * Convert metadata to TyphonJS AuxiliaryData format with enhanced validation
   * Supports multiple metadata formats and follows Cardano metadata standards
   * Uses TyphonJS utilities for proper auxiliary data creation
   */
  private convertMetadataToAuxiliaryData(metadata: any): TyphonTypes.AuxiliaryData {
    if (!metadata || typeof metadata !== 'object') {
      throw new ValidationError(
        ErrorCode.INVALID_INPUT,
        'Metadata must be a valid object',
        { field: 'metadata', value: metadata }
      );
    }

    try {
      // Check if TyphonJS provides direct auxiliary data creation
      if (TyphonUtils.createAuxiliaryDataCbor) {
        // Use TyphonJS for proper auxiliary data formatting
        const auxiliaryData = this.formatMetadataForTyphonJS(metadata);
        
        // Validate the auxiliary data using TyphonJS utilities
        const cborData = TyphonUtils.createAuxiliaryDataCbor(auxiliaryData);
        if (!cborData || cborData.length === 0) {
          throw new Error('Invalid auxiliary data generated');
        }
        
        return auxiliaryData;
      }
    } catch (error) {
      Logger.warn(`TyphonJS auxiliary data creation failed: ${(error as Error).message}, falling back to manual creation`);
    }

    const metadataEntries: Array<{ label: number; data: any }> = [];

    if (Array.isArray(metadata)) {
      // Handle array format metadata
      metadata.forEach((entry, index) => {
        if (typeof entry === 'object' && entry.label !== undefined) {
          this.validateMetadataLabel(entry.label);
          metadataEntries.push({
            label: entry.label,
            data: entry.data || entry
          });
        } else {
          // Use index as label for array entries without explicit labels
          metadataEntries.push({
            label: index,
            data: entry
          });
        }
      });
    } else if (typeof metadata === 'object') {
      // Handle object format metadata
      for (const [key, value] of Object.entries(metadata)) {
        const label = parseInt(key);
        if (isNaN(label)) {
          // Use default label 674 for non-numeric keys (general message format)
          metadataEntries.push({
            label: 674,
            data: { [key]: value }
          });
        } else {
          this.validateMetadataLabel(label);
          metadataEntries.push({
            label,
            data: value
          });
        }
      }
    }

    // If no valid metadata entries, use default format
    if (metadataEntries.length === 0) {
      metadataEntries.push({
        label: 674, // General message format
        data: metadata
      });
    }

    return {
      metadata: this.sortMetadataForConsistency(metadataEntries)
    };
  }

  /**
   * Validate metadata label according to Cardano standards
   */
  private validateMetadataLabel(label: number): void {
    if (!Number.isInteger(label) || label < 0 || label > Number.MAX_SAFE_INTEGER) {
      throw new ValidationError(
        ErrorCode.INVALID_INPUT,
        `Invalid metadata label: ${label}. Must be integer between 0 and 2^64-1`,
        { field: 'label', value: label }
      );
    }

    // Check for well-known reserved labels
    const wellKnownLabels = {
      20: 'Asset Name Service',
      61284: 'Plutus Script',
      61285: 'Native Script',
      674: 'General Message',
      721: 'NFT Metadata Standard'
    };

    // Log if using a well-known label for informational purposes
    if (wellKnownLabels[label as keyof typeof wellKnownLabels]) {
      Logger.debug(`Using well-known metadata label ${label}: ${wellKnownLabels[label as keyof typeof wellKnownLabels]}`);
    }
  }

  /**
   * Format metadata for TyphonJS auxiliary data creation
   */
  private formatMetadataForTyphonJS(metadata: any): TyphonTypes.AuxiliaryData {
    const metadataEntries: Array<{ label: number; data: any }> = [];
    
    if (Array.isArray(metadata)) {
      metadata.forEach((entry, index) => {
        if (typeof entry === 'object' && entry.label !== undefined) {
          this.validateMetadataLabel(entry.label);
          metadataEntries.push({
            label: entry.label,
            data: entry.data || entry
          });
        } else {
          metadataEntries.push({
            label: index,
            data: entry
          });
        }
      });
    } else if (typeof metadata === 'object') {
      for (const [key, value] of Object.entries(metadata)) {
        const label = parseInt(key);
        if (isNaN(label)) {
          metadataEntries.push({
            label: 674, // General message format
            data: { [key]: value }
          });
        } else {
          this.validateMetadataLabel(label);
          metadataEntries.push({
            label,
            data: value
          });
        }
      }
    }
    
    if (metadataEntries.length === 0) {
      metadataEntries.push({
        label: 674,
        data: metadata
      });
    }
    
    return {
      metadata: this.sortMetadataForConsistency(metadataEntries)
    };
  }

  /**
   * Sort metadata entries for consistent transaction building
   */
  private sortMetadataForConsistency(entries: Array<{ label: number; data: any }>): Array<{ label: number; data: any }> {
    // Sort by label for deterministic ordering (TyphonJS pattern)
    return entries.sort((a, b) => a.label - b.label);
  }

  /**
   * Get default TTL (current slot + 7200 slots ≈ 2 hours)
   */
  private getDefaultTtl(): number {
    // This would typically come from a network service
    // For now, use a reasonable future slot
    return Math.floor(Date.now() / 1000) + 7200;
  }

  /**
   * Validate build request
   */
  private validateBuildRequest(request: TransactionBuildRequest): void {
    if (!request.outputs || request.outputs.length === 0) {
      throw new ValidationError(ErrorCode.INVALID_INPUT, 'Transaction must have at least one output');
    }

    if (!request.changeAddress) {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Change address is required');
    }

    // Validate each output
    for (const output of request.outputs) {
      if (!output.address) {
        throw new ValidationError(ErrorCode.INVALID_ADDRESS, 'Output address is required');
      }
      
      if (output.amount <= 0) {
        throw new ValidationError(ErrorCode.INVALID_AMOUNT, 'Output amount must be positive');
      }
    }
  }

  /**
   * Validate UTXOs
   */
  private validateUtxos(utxos: UTXO[]): void {
    if (!utxos || utxos.length === 0) {
      throw new ValidationError(ErrorCode.INVALID_INPUT, 'At least one UTXO is required');
    }

    for (const utxo of utxos) {
      if (!utxo.txHash || utxo.txHash.length !== 64) {
        throw new ValidationError(ErrorCode.INVALID_INPUT, 'Invalid UTXO transaction hash');
      }
      
      if (typeof utxo.outputIndex !== 'number' || utxo.outputIndex < 0) {
        throw new ValidationError(ErrorCode.INVALID_INPUT, 'Invalid UTXO output index');
      }
      
      if (utxo.amount <= 0) {
        throw new ValidationError(ErrorCode.INVALID_AMOUNT, 'UTXO amount must be positive');
      }
    }
  }

  /**
   * Calculate minimum UTXO amount using standardized TyphonJS calculation
   * Public utility method for external use
   */
  calculateMinUtxoAmount(
    address: string,
    amount: BigNumber,
    tokens: TyphonTypes.Token[] = []
  ): BigNumber {
    const typhonAddress = TyphonUtils.getAddressFromString(address);
    if (!typhonAddress) {
      throw new ValidationError(ErrorCode.INVALID_ADDRESS, `Invalid address: ${address}`);
    }

    const typhonOutput: TyphonTypes.Output = {
      address: typhonAddress,
      amount,
      tokens
    };

    // Use standardized Babbage calculation
    if (TyphonUtils.calculateMinUtxoAmountBabbage && this.protocolParams.utxoCostPerByte) {
      return TyphonUtils.calculateMinUtxoAmountBabbage(
        typhonOutput,
        this.protocolParams.utxoCostPerByte
      );
    }
    // Fallback to legacy calculation
    else if (TyphonUtils.calculateMinUtxoAmount && this.protocolParams.lovelacePerUtxoWord) {
      return TyphonUtils.calculateMinUtxoAmount(
        tokens, 
        this.protocolParams.lovelacePerUtxoWord
      );
    }
    else {
      throw new ValidationError(
        ErrorCode.INVALID_INPUT,
        'Protocol parameters missing required min UTXO calculation fields'
      );
    }
  }

  /**
   * Update protocol parameters
   */
  updateProtocolParameters(params: TyphonTypes.ProtocolParams): void {
    this.protocolParams = params;
    Logger.debug('Protocol parameters updated');
  }

  /**
   * Get current protocol parameters
   */
  getProtocolParameters(): TyphonTypes.ProtocolParams {
    return this.protocolParams;
  }
}

// Export for backward compatibility
export { TyphonTransactionBuilder as CardanoTransactionBuilder };