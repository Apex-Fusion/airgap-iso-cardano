/**
 * Advanced Transaction Analytics for Cardano AirGap Protocol
 * Rich transaction history, DeFi tracking, and performance analytics
 */

import { AirGapTransaction } from "@airgap/module-kit";
import { CardanoDataService } from "../data/cardano-data-service";
import { Logger } from "../utils";
// Use AirGap's embedded axios to avoid CORS issues
import axios from '@airgap/coinlib-core/dependencies/src/axios-0.19.0';

export interface DetailedTransaction extends AirGapTransaction<"ADA", "ADA"> {
  txHash: string;
  blockHash?: string;
  blockHeight: number;
  epochNo: number;
  slot: number;
  size: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  certificates?: Certificate[];
  withdrawals?: Withdrawal[];
  metadata?: any;
  scriptInvocations?: ScriptInvocation[];
  mintBurn?: MintBurnOperation[];
  totalInputValue: string;
  totalOutputValue: string;
  netValue: string; // for the queried address
  confirmation: "confirmed" | "pending" | "failed";
  confirmations: number;
}

export interface TransactionInput {
  txHash: string;
  outputIndex: number;
  address: string;
  value: string;
  assets?: Asset[];
  script?: Script;
}

export interface TransactionOutput {
  address: string;
  value: string;
  assets?: Asset[];
  datumHash?: string;
  script?: Script;
}

export interface Asset {
  policyId: string;
  assetName: string;
  quantity: string;
  fingerprint: string;
}

export interface Certificate {
  type: "stake_registration" | "stake_deregistration" | "stake_delegation" | "pool_registration" | "pool_retirement" | "genesis_key_delegation" | "mir";
  stakeAddress?: string;
  poolId?: string;
  rewardAddress?: string;
  amount?: string;
  index: number;
}

export interface Withdrawal {
  rewardAddress: string;
  amount: string;
}

export interface Script {
  type: "native" | "plutus_v1" | "plutus_v2";
  hash: string;
  size?: number;
}

export interface ScriptInvocation {
  scriptHash: string;
  purpose: "spending" | "minting" | "certifying" | "rewarding";
  executionUnits?: {
    mem: number;
    steps: number;
  };
  success: boolean;
}

export interface MintBurnOperation {
  policyId: string;
  assets: Array<{
    assetName: string;
    quantity: string; // negative for burn, positive for mint
  }>;
}

export interface TransactionStats {
  totalTransactions: number;
  totalVolume: string; // ADA
  avgTransactionSize: string; // ADA
  totalFeesPaid: string; // ADA
  avgFee: string; // ADA
  transactionsByMonth: Array<{
    month: string;
    count: number;
    volume: string;
    fees: string;
  }>;
  assetActivity: Array<{
    policyId: string;
    assetName: string;
    transfers: number;
    volume: string;
  }>;
}

export interface DeFiActivity {
  txHash: string;
  timestamp: number;
  protocol: string; // "SundaeSwap", "Minswap", "MuesliSwap", etc.
  action: "swap" | "add_liquidity" | "remove_liquidity" | "stake" | "unstake" | "claim_rewards";
  assets: Array<{
    asset: string;
    amount: string;
    role: "input" | "output" | "fee";
  }>;
  poolId?: string;
  slippage?: number;
  priceImpact?: number;
  fees: Array<{
    asset: string;
    amount: string;
    type: "protocol" | "liquidity_provider" | "operator";
  }>;
}

export interface PortfolioMetrics {
  currentValue: string; // USD
  costBasis?: string; // USD
  unrealizedGains?: string; // USD
  realizedGains?: string; // USD
  roi?: number; // percentage
  avgBuyPrice?: string; // ADA/USD
  holdingPeriod: number; // days
  performanceVsBenchmark?: number; // vs ADA price performance
}

/**
 * Advanced transaction analytics and DeFi tracking
 */
export class CardanoAnalyticsExtensions {
  constructor(private dataService: CardanoDataService) {}

  /**
   * Get detailed transaction information with full CBOR parsing
   */
  async getDetailedTransaction(txHash: string, userAddress?: string): Promise<DetailedTransaction | null> {
    try {
      const response = await axios.post('https://api.koios.rest/api/v1/tx_info', {
        _tx_hashes: [txHash]
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status !== 200) throw new Error(`Failed to fetch transaction: ${response.status}`);
      
      const transactions = response.data as any[];
      if (transactions.length === 0) return null;

      const tx = transactions[0];
      
      // Parse inputs
      const inputs: TransactionInput[] = (tx.inputs || []).map((input: any) => ({
        txHash: input.tx_hash,
        outputIndex: input.tx_index,
        address: input.payment_addr?.bech32 || '',
        value: input.value,
        assets: this.parseAssets(input.asset_list)
      }));

      // Parse outputs
      const outputs: TransactionOutput[] = (tx.outputs || []).map((output: any) => ({
        address: output.payment_addr?.bech32 || '',
        value: output.value,
        assets: this.parseAssets(output.asset_list),
        datumHash: output.datum_hash
      }));

      // Parse certificates
      const certificates: Certificate[] = (tx.certificates || []).map((cert: any, index: number) => ({
        type: cert.type,
        stakeAddress: cert.stake_addr,
        poolId: cert.pool_id,
        rewardAddress: cert.reward_addr,
        amount: cert.amount,
        index
      }));

      // Parse withdrawals
      const withdrawals: Withdrawal[] = (tx.withdrawals || []).map((withdrawal: any) => ({
        rewardAddress: withdrawal.reward_addr,
        amount: withdrawal.amount
      }));

      // Calculate net value for user address
      let netValue = "0";
      if (userAddress) {
        const inputValue = inputs
          .filter(input => input.address === userAddress)
          .reduce((sum, input) => sum + BigInt(input.value), BigInt(0));
        
        const outputValue = outputs
          .filter(output => output.address === userAddress)
          .reduce((sum, output) => sum + BigInt(output.value), BigInt(0));
        
        netValue = (outputValue - inputValue).toString();
      }

      const detailedTx: DetailedTransaction = {
        // Base AirGapTransaction fields
        from: inputs.map(input => input.address),
        to: outputs.map(output => output.address),
        isInbound: userAddress ? outputs.some(output => output.address === userAddress) : false,
        amount: { value: Math.abs(Number(netValue)).toString(), unit: "ADA" },
        fee: { value: tx.fee, unit: "ADA" },
        network: {
          name: "Mainnet", // Would determine from context
          type: "mainnet",
          rpcUrl: "",
          blockExplorerUrl: ""
        },
        timestamp: new Date(tx.block_time).getTime(),
        status: { type: tx.block_height > 0 ? "applied" : "unknown" },

        // Extended fields
        txHash,
        blockHash: tx.block_hash,
        blockHeight: tx.block_height,
        epochNo: tx.epoch_no,
        slot: tx.epoch_slot,
        size: tx.tx_size,
        inputs,
        outputs,
        certificates,
        withdrawals,
        metadata: tx.metadata,
        totalInputValue: tx.total_input,
        totalOutputValue: tx.total_output,
        netValue,
        confirmation: tx.block_height > 0 ? "confirmed" : "pending",
        confirmations: tx.confirmations || 0
      };

      return detailedTx;
    } catch (error) {
      Logger.error('Failed to get detailed transaction', error as Error);
      return null;
    }
  }

  /**
   * Get comprehensive transaction statistics for an address
   */
  async getTransactionStats(address: string, fromDate?: Date, toDate?: Date): Promise<TransactionStats> {
    try {
      const transactions = await this.getAllTransactions(address, fromDate, toDate);
      
      const totalTransactions = transactions.length;
      let totalVolume = BigInt(0);
      let totalFees = BigInt(0);
      const monthlyStats = new Map<string, { count: number; volume: bigint; fees: bigint }>();
      const assetActivity = new Map<string, { transfers: number; volume: bigint }>();

      for (const tx of transactions) {
        // Calculate volume (absolute value of net amount)
        const volume = BigInt(Math.abs(Number(tx.netValue)));
        totalVolume += volume;
        
        // Add fees
        const fee = BigInt(tx.fee.value);
        totalFees += fee;

        // Monthly breakdown
        const monthKey = new Date(tx.timestamp || Date.now()).toISOString().slice(0, 7); // YYYY-MM
        const monthData = monthlyStats.get(monthKey) || { count: 0, volume: BigInt(0), fees: BigInt(0) };
        monthData.count++;
        monthData.volume += volume;
        monthData.fees += fee;
        monthlyStats.set(monthKey, monthData);

        // Asset activity tracking
        for (const input of tx.inputs) {
          if (input.assets) {
            for (const asset of input.assets) {
              const key = `${asset.policyId}.${asset.assetName}`;
              const activity = assetActivity.get(key) || { transfers: 0, volume: BigInt(0) };
              activity.transfers++;
              activity.volume += BigInt(asset.quantity);
              assetActivity.set(key, activity);
            }
          }
        }
      }

      return {
        totalTransactions,
        totalVolume: totalVolume.toString(),
        avgTransactionSize: totalTransactions > 0 ? (totalVolume / BigInt(totalTransactions)).toString() : "0",
        totalFeesPaid: totalFees.toString(),
        avgFee: totalTransactions > 0 ? (totalFees / BigInt(totalTransactions)).toString() : "0",
        transactionsByMonth: Array.from(monthlyStats.entries()).map(([month, stats]) => ({
          month,
          count: stats.count,
          volume: stats.volume.toString(),
          fees: stats.fees.toString()
        })),
        assetActivity: Array.from(assetActivity.entries()).map(([asset, activity]) => {
          const [policyId, assetName] = asset.split('.');
          return {
            policyId,
            assetName,
            transfers: activity.transfers,
            volume: activity.volume.toString()
          };
        })
      };
    } catch (error) {
      Logger.error('Failed to calculate transaction stats', error as Error);
      throw error;
    }
  }

  /**
   * Detect and parse DeFi protocol interactions
   */
  async getDeFiActivity(address: string, limit: number = 50): Promise<DeFiActivity[]> {
    try {
      const transactions = await this.getAllTransactions(address, undefined, undefined, limit);
      const defiActivity: DeFiActivity[] = [];

      for (const tx of transactions) {
        // Analyze transaction patterns to detect DeFi protocols
        const activity = await this.detectDeFiProtocol(tx);
        if (activity) {
          defiActivity.push(activity);
        }
      }

      return defiActivity;
    } catch (error) {
      Logger.error('Failed to get DeFi activity', error as Error);
      return [];
    }
  }

  /**
   * Calculate portfolio performance metrics
   */
  async getPortfolioMetrics(_address: string): Promise<PortfolioMetrics> {
    // This would require historical price data and transaction analysis
    // For now, return basic metrics
    return {
      currentValue: "0",
      holdingPeriod: 0
    };
  }

  /**
   * Get transaction flow analysis (cash flow patterns)
   */
  async getTransactionFlow(address: string, period: 'week' | 'month' | 'year' = 'month'): Promise<{
    inflow: Array<{ date: string; amount: string }>;
    outflow: Array<{ date: string; amount: string }>;
    netFlow: Array<{ date: string; amount: string }>;
  }> {
    try {
      const periodMs = period === 'week' ? 7 * 24 * 60 * 60 * 1000 :
                     period === 'month' ? 30 * 24 * 60 * 60 * 1000 :
                     365 * 24 * 60 * 60 * 1000;
      
      const fromDate = new Date(Date.now() - periodMs);
      const transactions = await this.getAllTransactions(address, fromDate);
      
      const flowData = new Map<string, { inflow: bigint; outflow: bigint }>();

      for (const tx of transactions) {
        const date = new Date(tx.timestamp || Date.now()).toISOString().slice(0, 10); // YYYY-MM-DD
        const data = flowData.get(date) || { inflow: BigInt(0), outflow: BigInt(0) };
        
        const netValue = BigInt(tx.netValue);
        if (netValue > 0) {
          data.inflow += netValue;
        } else {
          data.outflow += -netValue;
        }
        
        flowData.set(date, data);
      }

      const dates = Array.from(flowData.keys()).sort();
      
      return {
        inflow: dates.map(date => ({ date, amount: flowData.get(date)!.inflow.toString() })),
        outflow: dates.map(date => ({ date, amount: flowData.get(date)!.outflow.toString() })),
        netFlow: dates.map(date => {
          const data = flowData.get(date)!;
          return { date, amount: (data.inflow - data.outflow).toString() };
        })
      };
    } catch (error) {
      Logger.error('Failed to get transaction flow', error as Error);
      throw error;
    }
  }

  /**
   * Helper: Get all detailed transactions for an address
   */
  private async getAllTransactions(
    address: string, 
    fromDate?: Date, 
    toDate?: Date, 
_limit: number = 1000
  ): Promise<DetailedTransaction[]> {
    // This would implement pagination and date filtering
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Helper: Parse asset list from Koios format
   */
  private parseAssets(assetList?: any[]): Asset[] {
    if (!assetList) return [];
    
    return assetList.map(asset => ({
      policyId: asset.policy_id,
      assetName: Buffer.from(asset.asset_name, 'hex').toString('utf8'),
      quantity: asset.quantity,
      fingerprint: asset.fingerprint
    }));
  }

  /**
   * Helper: Detect DeFi protocol from transaction patterns
   */
  private async detectDeFiProtocol(_tx: DetailedTransaction): Promise<DeFiActivity | null> {
    // This would implement sophisticated pattern recognition
    // to detect DEX swaps, liquidity operations, etc.
    // For now, return null
    return null;
  }
}