/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger, Security } from '../utils';
import { Balance } from '@airgap/module-kit';
import { utils as TyphonUtils, types as TyphonTypes } from '@stricahq/typhonjs';
import { TyphonProtocolParams, CARDANO_PROTOCOL_DEFAULTS } from '../types/domain';
import { ProtocolParamsNormalizer, RawProtocolParams } from '../utils/protocol-params-normalizer';
import { ErrorRecoveryService } from '../utils/error-recovery';
import BigNumber from 'bignumber.js';
// Use AirGap's embedded axios to avoid CORS issues (same as Rootstock module)
import axios from '@airgap/coinlib-core/dependencies/src/axios-0.19.0';

/**
 * Interface for Cardano data providers
 */
interface TransactionDetails {
  hash: string;
  blockHeight: number;
  timestamp: number;
  amount: { value: string; unit: "ADA" };
  fee: { value: string; unit: "ADA" };
  from: string[];
  to: string[];
  isInbound: boolean;
  confirmations?: number;
}

interface DataProvider {
  name: string;
  getBalance(address: string): Promise<Balance>;
  getUtxos(address: string): Promise<Array<{ txHash: string; outputIndex: number; amount: string; assets?: any[] }>>;
  getTransactions(address: string): Promise<Array<TransactionDetails>>;
  getProtocolParameters(): Promise<any>;
  broadcastTransaction?(signedTx: string): Promise<string>;
}

/**
 * Koios API provider - Community-driven, no API key required
 * Using AirGap CORS proxy for WebView compatibility
 */
class KoiosProvider implements DataProvider {
  name = "Koios";
  private static readonly BASE_URL = "https://api.koios.rest/api/v1";
  private static readonly CORS_PROXY = "https://cors-proxy.airgap.prod.gke.papers.tech/proxy?url=";

  private assembleRequestUrl(url: string): string {
    return `${KoiosProvider.CORS_PROXY}${url}`;
  }

  async getBalance(address: string): Promise<Balance> {
    const targetUrl = `${KoiosProvider.BASE_URL}/address_info`;
    const proxiedUrl = this.assembleRequestUrl(targetUrl);
    
    const response = await axios.post(proxiedUrl, {
      _addresses: [address]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status !== 200) throw new Error(`Koios API error: ${response.status}`);
    
    const data = response.data as any[];
    if (!data[0]) throw new Error('Address not found');
    
    // Koios returns balance in lovelace (1 ADA = 1,000,000 lovelace)
    const lovelaceBalance = data[0].balance || "0";
    const adaBalance = (parseInt(lovelaceBalance) / 1_000_000).toString();
    
    return {
      total: { value: adaBalance, unit: "ADA" },
      transferable: { value: adaBalance, unit: "ADA" }
    };
  }

  async getUtxos(address: string): Promise<Array<{ txHash: string; outputIndex: number; amount: string; assets?: any[] }>> {
    const targetUrl = `${KoiosProvider.BASE_URL}/address_utxos`;
    const proxiedUrl = this.assembleRequestUrl(targetUrl);
    
    const response = await axios.post(proxiedUrl, {
      _addresses: [address]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status !== 200) throw new Error(`Koios UTXO API error: ${response.status}`);
    
    const data = response.data as any[];
    return data.map((utxo: any) => ({
      txHash: utxo.tx_hash,
      outputIndex: utxo.tx_index,
      amount: (parseInt(utxo.value || "0") / 1_000_000).toString(), // Convert lovelace to ADA
      assets: utxo.asset_list || []
    }));
  }

  async getTransactions(address: string): Promise<Array<TransactionDetails>> {
    // First, get basic transaction list
    const targetUrl = `${KoiosProvider.BASE_URL}/address_txs`;
    const proxiedUrl = this.assembleRequestUrl(targetUrl);
    
    const response = await axios.post(proxiedUrl, {
      _addresses: [address]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status !== 200) throw new Error(`Koios transactions API error: ${response.status}`);
    
    const transactions = response.data as any[];
    
    // Get detailed info for each transaction (limit to recent 10 for performance)
    const recentTxs = transactions.slice(0, 10);
    const detailedTransactions: TransactionDetails[] = [];
    
    for (const tx of recentTxs) {
      try {
        const details = await this.getTransactionDetails(tx.tx_hash, address);
        detailedTransactions.push({
          hash: tx.tx_hash,
          blockHeight: tx.block_height || 0,
          timestamp: new Date(tx.block_time).getTime(),
          ...details
        });
      } catch (error) {
        // Fallback to basic transaction info if detailed fetch fails
        detailedTransactions.push({
          hash: tx.tx_hash,
          blockHeight: tx.block_height || 0,
          timestamp: new Date(tx.block_time).getTime(),
          amount: { value: "0", unit: "ADA" },
          fee: { value: "0", unit: "ADA" },
          from: [address],
          to: [address],
          isInbound: false
        });
      }
    }
    
    return detailedTransactions;
  }

  private async getTransactionDetails(txHash: string, userAddress: string): Promise<{
    amount: { value: string; unit: "ADA" };
    fee: { value: string; unit: "ADA" };
    from: string[];
    to: string[];
    isInbound: boolean;
  }> {
    const targetUrl = `${KoiosProvider.BASE_URL}/tx_info`;
    const proxiedUrl = this.assembleRequestUrl(targetUrl);
    
    const response = await axios.post(proxiedUrl, {
      _tx_hashes: [txHash]
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status !== 200) throw new Error(`Koios tx_info API error: ${response.status}`);
    
    const txData = response.data[0];
    if (!txData) throw new Error('Transaction not found');
    
    // Get the output value for user address (this is what they received)
    const userOutputValue = (txData.outputs || [])
      .filter((output: any) => output.payment_addr?.bech32 === userAddress)
      .reduce((sum: number, output: any) => sum + parseInt(output.value || "0"), 0);
    
    // For display, use the output value directly
    const isInbound = userOutputValue > 0;
    
    // Extract unique addresses
    const fromAddresses = [...new Set((txData.inputs || [])
      .map((input: any) => input.payment_addr?.bech32)
      .filter((addr: any) => addr && typeof addr === 'string')
    )] as string[];
    
    const toAddresses = [...new Set((txData.outputs || [])
      .map((output: any) => output.payment_addr?.bech32)
      .filter((addr: any) => addr && typeof addr === 'string')
    )] as string[];
    
    // Transaction fee in lovelace (keep as smallest unit for AirGap)
    const feeLovelace = parseInt(txData.fee || "0");
    
    // Provide amounts in ADA (not lovelace) for transaction display
    return {
      amount: { value: (userOutputValue / 1_000_000).toString(), unit: "ADA" },
      fee: { value: (feeLovelace / 1_000_000).toString(), unit: "ADA" },
      from: fromAddresses,
      to: toAddresses,
      isInbound
    };
  }

  async getProtocolParameters(): Promise<TyphonTypes.ProtocolParams> {
    return ErrorRecoveryService.protocolParams(async () => {
      Logger.debug('Fetching protocol parameters from Koios');
      
      const targetUrl = `${KoiosProvider.BASE_URL}/epoch_params?_epoch_no=current`;
      const proxiedUrl = this.assembleRequestUrl(targetUrl);
      
      const response = await axios.get(proxiedUrl);
      if (response.status !== 200) {
        throw new Error(`Koios protocol params error: ${response.status}`);
      }
      
      const data = response.data as any[];
      const rawParams = data[0] || {};
      
      Logger.debug('Raw protocol parameters received', {
        provider: 'Koios',
        fieldsCount: Object.keys(rawParams).length,
        hasMinFeeA: rawParams.min_fee_a !== undefined,
        hasMinFeeB: rawParams.min_fee_b !== undefined
      });
      
      // Use the normalizer to convert to TyphonJS format
      const normalizedParams = ProtocolParamsNormalizer.normalize(rawParams as RawProtocolParams);
      
      Logger.debug('Protocol parameters normalized', ProtocolParamsNormalizer.toDebugFormat(normalizedParams));
      
      return normalizedParams;
    }, 'fetch-protocol-parameters').catch(error => {
      Logger.error('Failed to fetch protocol parameters after retries', error as Error);
      
      // Return default parameters with proper types
      Logger.warn('Using default protocol parameters due to fetch failure');
      return ProtocolParamsNormalizer.normalize({});
    });
  }

  async broadcastTransaction(signedTx: string): Promise<string> {
    const targetUrl = `${KoiosProvider.BASE_URL}/submittx`;
    const proxiedUrl = this.assembleRequestUrl(targetUrl);
    
    const response = await axios.post(proxiedUrl, signedTx, {
      headers: { 'Content-Type': 'application/cbor' }
    });
    
    if (response.status !== 200) throw new Error(`Koios broadcast error: ${response.status}`);
    
    return response.data;
  }
}

/**
 * CardanoScan API provider - Popular explorer, no API key required
 */
class CardanoScanProvider implements DataProvider {
  name = "CardanoScan";
  private static readonly BASE_URL = "https://cardanoscan.io/api/core";

  async getBalance(address: string): Promise<Balance> {
    const response = await axios.get(`${CardanoScanProvider.BASE_URL}/addresses/${address}`);
    if (response.status !== 200) throw new Error(`CardanoScan API error: ${response.status}`);
    
    const data = response.data as any;
    const adaBalance = data.balance?.ada || "0";
    
    return {
      total: { value: adaBalance, unit: "ADA" },
      transferable: { value: adaBalance, unit: "ADA" }
    };
  }

  async getUtxos(address: string): Promise<Array<{ txHash: string; outputIndex: number; amount: string; assets?: any[] }>> {
    const response = await axios.get(`${CardanoScanProvider.BASE_URL}/addresses/${address}/utxos`);
    if (response.status !== 200) throw new Error(`CardanoScan UTXO API error: ${response.status}`);
    
    const data = response.data as any[];
    return data.map((utxo: any) => ({
      txHash: utxo.tx_hash,
      outputIndex: utxo.tx_index,
      amount: utxo.amount,
      assets: utxo.assets || []
    }));
  }

  async getTransactions(address: string): Promise<Array<TransactionDetails>> {
    const response = await axios.get(`${CardanoScanProvider.BASE_URL}/addresses/${address}/transactions`);
    if (response.status !== 200) throw new Error(`CardanoScan transactions API error: ${response.status}`);
    
    const data = response.data as any[];
    return data.map((tx: any) => ({
      hash: tx.hash,
      blockHeight: tx.block?.height || 0,
      timestamp: new Date(tx.block?.time || Date.now()).getTime(),
      amount: { value: "0", unit: "ADA" },
      fee: { value: "0", unit: "ADA" },
      from: [address],
      to: [address],
      isInbound: false
    }));
  }

  async getProtocolParameters(): Promise<any> {
    const response = await axios.get(`${CardanoScanProvider.BASE_URL}/protocol-parameters`);
    if (response.status !== 200) throw new Error(`CardanoScan protocol params error: ${response.status}`);
    
    const params = response.data as any;
    
    // Enhanced protocol parameters mapping for TyphonJS compatibility
    return {
      ...params,
      // Ensure all required fields are present with defaults
      min_fee_a: params.min_fee_a || params.minFeeA || 44,
      min_fee_b: params.min_fee_b || params.minFeeB || 155381,
      max_tx_size: params.max_tx_size || params.maxTxSize || 16384,
      utxo_cost_per_word: params.utxo_cost_per_word || params.utxoCostPerWord || 4310,
      pool_deposit: params.pool_deposit || params.poolDeposit || '500000000',
      key_deposit: params.key_deposit || params.keyDeposit || '2000000',
      coins_per_utxo_word: params.coins_per_utxo_word || params.utxo_cost_per_word || 4310,
      max_val_size: params.max_val_size || params.maxValSize || 5000,
      price_mem: params.price_mem || params.priceMem || 0.0577,
      price_step: params.price_step || params.priceStep || 0.0000721,
      collateral_percent: params.collateral_percent || params.collateralPercent || 150,
      max_collateral_inputs: params.max_collateral_inputs || params.maxCollateralInputs || 3
    };
  }
}

/**
 * Blockfrost public endpoints - Limited but free
 */
class BlockfrostPublicProvider implements DataProvider {
  name = "Blockfrost Public";
  private static readonly BASE_URL = "https://cardano-mainnet.blockfrost.io/api/v0";

  async getBalance(address: string): Promise<Balance> {
    const response = await axios.get(`${BlockfrostPublicProvider.BASE_URL}/addresses/${address}`);
    if (response.status !== 200) throw new Error(`Blockfrost public API error: ${response.status}`);
    
    const data = response.data as any;
    const lovelaceAmount = data.amount?.find((a: any) => a.unit === 'lovelace')?.quantity || "0";
    const adaAmount = (parseInt(lovelaceAmount) / 1_000_000).toString();
    
    return {
      total: { value: adaAmount, unit: "ADA" },
      transferable: { value: adaAmount, unit: "ADA" }
    };
  }

  async getUtxos(address: string): Promise<Array<{ txHash: string; outputIndex: number; amount: string; assets?: any[] }>> {
    const response = await axios.get(`${BlockfrostPublicProvider.BASE_URL}/addresses/${address}/utxos`);
    if (response.status !== 200) throw new Error(`Blockfrost public UTXO API error: ${response.status}`);
    
    const data = response.data as any[];
    return data.map((utxo: any) => ({
      txHash: utxo.tx_hash,
      outputIndex: utxo.output_index,
      amount: (parseInt(utxo.amount.find((a: any) => a.unit === 'lovelace')?.quantity || "0") / 1_000_000).toString(),
      assets: utxo.amount.filter((a: any) => a.unit !== 'lovelace')
    }));
  }

  async getTransactions(address: string): Promise<Array<TransactionDetails>> {
    const response = await axios.get(`${BlockfrostPublicProvider.BASE_URL}/addresses/${address}/transactions`);
    if (response.status !== 200) throw new Error(`Blockfrost public transactions API error: ${response.status}`);
    
    const data = response.data as any[];
    return data.map((tx: any) => ({
      hash: tx.tx_hash,
      blockHeight: tx.block_height || 0,
      timestamp: tx.block_time * 1000, // Convert to milliseconds
      amount: { value: "0", unit: "ADA" },
      fee: { value: "0", unit: "ADA" },
      from: [address],
      to: [address],
      isInbound: false
    }));
  }

  async getProtocolParameters(): Promise<any> {
    const response = await axios.get(`${BlockfrostPublicProvider.BASE_URL}/epochs/latest/parameters`);
    if (response.status !== 200) throw new Error(`Blockfrost public protocol params error: ${response.status}`);
    
    const params = response.data as any;
    
    // Enhanced protocol parameters mapping for TyphonJS compatibility
    return {
      ...params,
      // Map Blockfrost field names to standard names
      min_fee_a: params.min_fee_a || CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_A,
      min_fee_b: params.min_fee_b || CARDANO_PROTOCOL_DEFAULTS.MIN_FEE_B,
      max_tx_size: params.max_tx_size || CARDANO_PROTOCOL_DEFAULTS.MAX_TX_SIZE,
      utxo_cost_per_word: params.utxo_cost_per_word || CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD,
      pool_deposit: params.pool_deposit || CARDANO_PROTOCOL_DEFAULTS.POOL_DEPOSIT,
      key_deposit: params.key_deposit || CARDANO_PROTOCOL_DEFAULTS.KEY_DEPOSIT,
      coins_per_utxo_word: params.utxo_cost_per_word || CARDANO_PROTOCOL_DEFAULTS.UTXO_COST_PER_WORD,
      max_val_size: params.max_val_size || CARDANO_PROTOCOL_DEFAULTS.MAX_VAL_SIZE,
      price_mem: params.price_mem || CARDANO_PROTOCOL_DEFAULTS.PRICE_MEM,
      price_step: params.price_step || CARDANO_PROTOCOL_DEFAULTS.PRICE_STEP,
      collateral_percent: params.collateral_percent || CARDANO_PROTOCOL_DEFAULTS.COLLATERAL_PERCENT,
      max_collateral_inputs: params.max_collateral_inputs || CARDANO_PROTOCOL_DEFAULTS.MAX_COLLATERAL_INPUTS
    };
  }

  async broadcastTransaction(signedTx: string): Promise<string> {
    const response = await axios.post(`${BlockfrostPublicProvider.BASE_URL}/tx/submit`, signedTx, {
      headers: { 'Content-Type': 'application/cbor' }
    });
    
    if (response.status !== 200) throw new Error(`Blockfrost broadcast error: ${response.status}`);
    
    return response.data;
  }
}

/**
 * Multi-provider Cardano data service with automatic failover
 * Uses multiple free APIs to ensure reliability
 */
export class CardanoDataService {
  private readonly providers: DataProvider[];
  private readonly isTestnet: boolean;

  constructor(options: { testnet?: boolean } = {}) {
    this.isTestnet = options.testnet ?? false;
    
    // Initialize providers in order of preference (best first)
    this.providers = [
      new KoiosProvider(),           // Most reliable for free usage
      new CardanoScanProvider(),     // Good fallback
      new BlockfrostPublicProvider() // Last resort (rate limited)
    ];
    
    Logger.info(`Initialized ${this.providers.length} data providers for Cardano data`);
  }

  /**
   * Get account balance with automatic failover
   */
  async getBalance(address: string): Promise<Balance> {
    return this.executeWithFailover(
      'getBalance',
      (provider) => provider.getBalance(address),
      address
    );
  }

  /**
   * Get UTXOs for an address with automatic failover
   */
  async getUtxos(address: string): Promise<Array<{ txHash: string; outputIndex: number; amount: string; assets?: any[] }>> {
    return this.executeWithFailover(
      'getUtxos',
      (provider) => provider.getUtxos(address),
      address
    );
  }

  /**
   * Get transactions for an address with automatic failover
   */
  async getTransactions(address: string): Promise<Array<TransactionDetails>> {
    return this.executeWithFailover(
      'getTransactions', 
      (provider) => provider.getTransactions(address),
      address
    );
  }

  /**
   * Get protocol parameters with automatic failover
   */
  async getProtocolParameters(): Promise<any> {
    return this.executeWithFailover(
      'getProtocolParameters',
      (provider) => provider.getProtocolParameters(),
      'current'
    );
  }

  /**
   * Broadcast transaction with automatic failover
   */
  async broadcastTransaction(signedTx: string): Promise<string> {
    const broadcastProviders = this.providers.filter(p => p.broadcastTransaction);
    
    for (const provider of broadcastProviders) {
      try {
        Logger.debug(`Attempting broadcast with ${provider.name}`);
        
        // Rate limiting for broadcast operations
        const rateCheck = Security.checkRateLimit(`broadcast-${provider.name}`, 5, 60000); // 5 per minute
        if (!rateCheck.allowed) {
          Logger.warn(`Rate limit exceeded for ${provider.name}, trying next provider`);
          continue;
        }

        const result = await provider.broadcastTransaction!(signedTx);
        Logger.info(`Transaction broadcast successful via ${provider.name}, txId: ${result}`);
        return result;
        
      } catch (error) {
        const sanitizedError = Security.sanitizeErrorMessage(error as Error, 'CardanoDataService');
        Logger.warn(`Broadcast failed with ${provider.name}: ${sanitizedError}`);
        
        // Continue to next provider
        continue;
      }
    }
    
    throw new Error('All broadcast providers failed');
  }

  /**
   * Execute an operation with automatic failover across providers
   */
  private async executeWithFailover<T>(
    operation: string,
    executor: (provider: DataProvider) => Promise<T>,
    identifier: string
  ): Promise<T> {
    const errors: string[] = [];
    
    for (const provider of this.providers) {
      try {
        Logger.debug(`Trying ${operation} with ${provider.name}`, { identifier });
        
        // Rate limiting per provider
        const rateCheck = Security.checkRateLimit(`${provider.name.toLowerCase()}-${operation}`, 30, 60000); // 30 per minute
        if (!rateCheck.allowed) {
          Logger.warn(`Rate limit exceeded for ${provider.name}, trying next provider`);
          errors.push(`${provider.name}: Rate limit exceeded`);
          continue;
        }

        const result = await executor(provider);
        Logger.debug(`${operation} successful with ${provider.name}`, { identifier });
        return result;
        
      } catch (error) {
        const sanitizedError = Security.sanitizeErrorMessage(error as Error, 'CardanoDataService');
        Logger.warn(`${operation} failed with ${provider.name}: ${sanitizedError}`);
        errors.push(`${provider.name}: ${sanitizedError}`);
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
    throw new Error(`All data providers failed for ${operation}. Errors: ${errors.join(', ')}`);
  }

  /**
   * Get the current active providers
   */
  getProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  /**
   * Test connectivity to all providers
   */
  async testConnectivity(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const provider of this.providers) {
      try {
        await provider.getProtocolParameters();
        results[provider.name] = true;
      } catch (error) {
        results[provider.name] = false;
      }
    }
    
    return results;
  }

  /**
   * Enhanced UTXO processing with TyphonJS validation
   */
  async getValidatedUtxos(
    address: string,
    protocolParams?: TyphonProtocolParams
  ): Promise<Array<{
    txHash: string;
    outputIndex: number;
    amount: string;
    assets?: any[];
    isValid: boolean;
    minUtxo?: string;
  }>> {
    const utxos = await this.getUtxos(address);
    
    if (!protocolParams) {
      // Return UTXOs without validation if no protocol params available
      return utxos.map(utxo => ({ ...utxo, isValid: true }));
    }

    const validatedUtxos = [];
    
    for (const utxo of utxos) {
      try {
        // Use TyphonJS to calculate minimum UTXO amount
        const amount = BigInt(Math.floor(parseFloat(utxo.amount) * 1_000_000)); // Convert ADA to lovelace
        
        // Create output object for TyphonJS calculation
        const addressObj = TyphonUtils.getAddressFromString(address);
        
        if (!addressObj) {
          throw new Error('Invalid address format');
        }
        
        const outputForCalculation = {
          address: addressObj,
          amount: new BigNumber(amount.toString()),
          tokens: utxo.assets ? utxo.assets.map((asset: any) => ({
            policyId: asset.unit ? asset.unit.substring(0, 56) : '',
            assetName: asset.unit ? asset.unit.substring(56) : '',
            amount: new BigNumber(asset.quantity || '1')
          })) : []
        };
        
        const minUtxo = TyphonUtils.calculateMinUtxoAmountBabbage(
          outputForCalculation,
          new BigNumber(protocolParams.coinsPerUtxoWord)
        );
        
        // Convert BigNumber to bigint for comparison
        const minUtxoBigInt = BigInt(minUtxo.toString());
        const isValid = amount >= minUtxoBigInt;
        
        validatedUtxos.push({
          ...utxo,
          isValid,
          minUtxo: (Number(minUtxoBigInt) / 1_000_000).toString() // Convert back to ADA
        });
      } catch (error) {
        Logger.warn(`UTXO validation failed for ${utxo.txHash}:${utxo.outputIndex}: ${(error as Error).message}`);
        // Include invalid UTXOs with validation flag
        validatedUtxos.push({
          ...utxo,
          isValid: false,
          minUtxo: '1.0' // Default minimum
        });
      }
    }
    
    return validatedUtxos;
  }

  /**
   * Get TyphonJS-compatible protocol parameters
   */
  async getTyphonProtocolParams(): Promise<TyphonProtocolParams> {
    const params = await this.getProtocolParameters();
    
    return {
      minFeeA: params.min_fee_a || 44,
      minFeeB: params.min_fee_b || 155381,
      maxTxSize: params.max_tx_size || 16384,
      coinsPerUtxoWord: params.coins_per_utxo_word || 4310,
      poolDeposit: BigInt(params.pool_deposit || '500000000'),
      keyDeposit: BigInt(params.key_deposit || '2000000'),
      maxValSize: params.max_val_size || 5000,
      maxCollateralInputs: params.max_collateral_inputs || 3,
      collateralPercent: params.collateral_percent || 150,
      priceMem: params.price_mem || 0.0577,
      priceStep: params.price_step || 0.0000721,
    };
  }

  /**
   * Address validation using TyphonJS
   */
  async validateAddress(address: string): Promise<{
    isValid: boolean;
    type?: string;
    network?: string;
    error?: string;
  }> {
    try {
      const parsedAddress = TyphonUtils.getAddressFromString(address);
      
      if (!parsedAddress) {
        return {
          isValid: false,
          error: 'Invalid address format'
        };
      }
      
      // Determine address type and network
      const hex = parsedAddress.getHex();
      const firstByte = parseInt(hex.substring(0, 2), 16);
      
      let type = 'unknown';
      let network = 'unknown';
      
      // Decode address type from first byte (Cardano CIP-19 specification)
      const addressType = (firstByte & 0b11110000) >> 4;
      const networkTag = firstByte & 0b00001111;
      
      switch (addressType) {
        case 0b0000:
        case 0b0001:
          type = 'base';
          break;
        case 0b0010:
        case 0b0011:
          type = 'pointer';
          break;
        case 0b0100:
        case 0b0101:
          type = 'enterprise';
          break;
        case 0b0110:
        case 0b0111:
          type = 'reward';
          break;
        case 0b1000:
          type = 'byron';
          break;
        default:
          type = 'unknown';
      }
      
      network = networkTag === 1 ? 'mainnet' : 'testnet';
      
      return {
        isValid: true,
        type,
        network
      };
    } catch (error) {
      return {
        isValid: false,
        error: (error as Error).message
      };
    }
  }

}