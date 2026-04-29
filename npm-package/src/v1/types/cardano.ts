export interface CardanoAsset {
  unit: string; // Policy ID + Asset Name (hex)
  quantity: string;
  policy_id: string;
  asset_name: string;
  fingerprint: string;
  metadata?: {
    name?: string;
    description?: string;
    ticker?: string;
    decimals?: number;
    logo?: string;
  };
}

export interface CardanoUnspentOutput {
  tx_hash: string;
  tx_index: number;
  amount: string; // ADA in lovelace
  address: string;
  assets?: CardanoAsset[]; // Native tokens
}

export interface CardanoTransactionInput {
  txHash: string;
  outputIndex: number;
}

export interface CardanoTransactionOutput {
  address: string;
  amount: string;
}

// Transaction types moved to domain.ts to avoid AirGap interface conflicts

export interface CardanoAccountInfo {
  address: string;
  balance: string; // ADA in lovelace
  assets: CardanoAsset[]; // All native tokens held by this address
  utxos: CardanoUnspentOutput[];
}

export interface CardanoNetworkParameters {
  min_fee_a: number;         // Linear fee coefficient
  min_fee_b: number;         // Constant fee coefficient  
  max_tx_size: number;       // Maximum transaction size
  utxo_cost_per_word: string; // Cost per UTXO word
  key_deposit: string;       // Key registration deposit
  pool_deposit: string;      // Pool registration deposit
  max_epoch: number;         // Maximum epoch
  optimal_pool_count: number; // k parameter
  influence: number;         // a0 parameter
  monetary_expand_rate: number; // ρ parameter
  treasury_growth_rate: number; // τ parameter
  decentralisation: number;  // d parameter
  protocol_major_ver: number; // Protocol major version
  protocol_minor_ver: number; // Protocol minor version
  min_utxo: string;         // Minimum UTXO value
}

export interface CardanoFeeEstimation {
  base_fee: string;          // Base transaction fee
  size_fee: string;          // Fee based on transaction size
  script_fee?: string;       // Additional fee for scripts
  total_fee: string;         // Total estimated fee
  min_fee: string;           // Minimum possible fee
  max_fee: string;           // Maximum reasonable fee
  network_parameters_used: boolean; // Whether real network params were used
}

export interface CardanoProtocolOptions {
  network: "mainnet" | "testnet";
  blockfrostApiKey?: string;
  cardanoscanApiKey?: string;
  enablePerformanceMonitoring?: boolean;
}
