/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Core Domain Types for AirGap Cardano Module
 * Enhanced with TyphonJS type integration for better protocol compliance
 * Provides type safety and clear interfaces for all domain objects
 */

import { types as TyphonTypes } from '@stricahq/typhonjs';
import { maxTokenAmount, maxAdaAmount } from '@stricahq/typhonjs/dist/constants';

// Enhanced Cardano constants using TyphonJS where available
export const CARDANO_CONSTANTS = {
  // TyphonJS-provided constants
  MAX_TOKEN_AMOUNT: maxTokenAmount,
  MAX_ADA_AMOUNT: maxAdaAmount,
  
  // Core Cardano protocol constants
  LOVELACE_PER_ADA: 1_000_000,
  ADA_DECIMALS: 6,
  
  // Transaction size constants
  MIN_TX_SIZE: 165,
  MAX_TX_SIZE: 16384,
  
  // UTXO constants  
  MIN_UTXO_ADA: 1_000_000, // 1 ADA minimum
  UTXO_STORAGE_COST: 34482, // Approximate cost per UTXO in lovelace
  
  // Address constants
  BECH32_ADDR_PREFIX_MAINNET: 'addr',
  BECH32_ADDR_PREFIX_TESTNET: 'addr_test',
  BECH32_STAKE_PREFIX_MAINNET: 'stake',
  BECH32_STAKE_PREFIX_TESTNET: 'stake_test',
  
  // Asset constants
  POLICY_ID_LENGTH: 56, // 28 bytes = 56 hex chars
  MAX_ASSET_NAME_LENGTH: 64, // 32 bytes = 64 hex chars
  
  // Cryptographic hash constants
  KEY_HASH_SIZE: 28, // Blake2b-224 = 28 bytes
  SCRIPT_HASH_SIZE: 28, // Blake2b-224 = 28 bytes
  TRANSACTION_HASH_SIZE: 32, // Blake2b-256 = 32 bytes
} as const;

// TyphonJS Constants Integration (backward compatibility)
export const MAX_TOKEN_AMOUNT = CARDANO_CONSTANTS.MAX_TOKEN_AMOUNT;
export const MAX_ADA_AMOUNT = CARDANO_CONSTANTS.MAX_ADA_AMOUNT;

// Cardano Protocol Constants (current mainnet values as of 2024)
// These are default fallback values - real values should be fetched from network
export const CARDANO_PROTOCOL_DEFAULTS = {
  MIN_FEE_A: 44,
  MIN_FEE_B: 155381, 
  MAX_TX_SIZE: 16384,
  UTXO_COST_PER_WORD: 4310,
  KEY_DEPOSIT: '2000000',
  POOL_DEPOSIT: '500000000',
  MAX_VAL_SIZE: 5000,
  PRICE_MEM: 0.0577,
  PRICE_STEP: 0.0000721,
  COLLATERAL_PERCENT: 150,
  MAX_COLLATERAL_INPUTS: 3
} as const;

// Hardened Derivation Constants
export const HARDENED_OFFSET = 0x80000000;

// CIP-1852 Derivation Path Constants
export const CIP1852_DERIVATION = {
  PURPOSE: 1852,
  COIN_TYPE: 1815, // Cardano's coin type
  CHANGE_ADDRESS: 1,
  STAKE_KEY: 2
} as const;

// Base types
export type HexString = string;
export type Address = string;
export type PolicyId = HexString;
export type AssetName = HexString;
export type TxHash = HexString;
export type Quantity = bigint;
export type Lovelace = bigint;
export type SlotNumber = number;

// Network types (using TyphonJS NetworkId for better compatibility)
export type NetworkType = "mainnet" | "testnet" | "preview" | "preprod";
export type TyphonNetworkId = TyphonTypes.NetworkId;
export const NetworkId = TyphonTypes.NetworkId;

// UTXO and Transaction types (TyphonJS compatible structure)
export interface UTXO {
  readonly txHash: TxHash;
  readonly outputIndex: number;
  readonly amount: Lovelace;
  readonly address: Address;
  readonly assets?: MultiAsset;
}

// TyphonJS-compatible transaction input/output types
export interface TyphonInput {
  readonly txHash: string;
  readonly index: number;
}

export interface TyphonOutput {
  readonly address: string;
  readonly amount: bigint;
  readonly multiAsset?: Map<string, Map<string, bigint>>;
}

export interface TransactionInput extends UTXO {}

export interface TransactionOutput {
  readonly address: Address;
  readonly amount: Lovelace;
  readonly assets?: MultiAsset;
}

export interface MultiAsset {
  readonly [policyId: PolicyId]: {
    readonly [assetName: AssetName]: Quantity;
  };
}

// Transaction types (enhanced with TyphonJS compatibility)
export interface CardanoUnsignedTransaction {
  readonly type: "unsigned";
  readonly inputs: TransactionInput[];
  readonly outputs: TransactionOutput[];
  readonly fee: Lovelace;
  readonly ttl?: SlotNumber;
  readonly metadata?: TransactionMetadata;
  readonly auxiliaryData?: AuxiliaryData;
  readonly certificates?: TyphonCertificate[];
  readonly withdrawals?: Map<string, bigint>;
}

// TyphonJS certificate types for better protocol compliance
export type TyphonCertificateType = TyphonTypes.CertificateType;
export const CertificateType = TyphonTypes.CertificateType;

export interface TyphonCertificate {
  readonly type: TyphonCertificateType;
  readonly stakeCredential?: Credential;
  readonly poolKeyHash?: HexString;
  readonly epoch?: number; // For pool retirement
}

export interface CardanoSignedTransaction {
  readonly type: "signed";
  readonly txHash: TxHash;
  readonly witnesses: TransactionWitness[];
  readonly unsignedTx: CardanoUnsignedTransaction;
}

export interface TransactionMetadata {
  readonly [label: number]: any;
}

export interface AuxiliaryData {
  readonly metadata?: TransactionMetadata;
  readonly nativeScripts?: NativeScript[];
  readonly plutusScripts?: PlutusScript[];
}

// Script types
export interface NativeScript {
  readonly type: "native";
  readonly script: any; // Native script structure
}

export interface PlutusScript {
  readonly type: "plutus";
  readonly version: "PlutusV1" | "PlutusV2";
  readonly script: Uint8Array;
}

// Witness types
export interface TransactionWitness {
  readonly vkeyWitnesses?: VKeyWitness[];
  readonly bootstrapWitnesses?: BootstrapWitness[];
  readonly plutusData?: PlutusData[];
  readonly redeemers?: Redeemer[];
}

export interface VKeyWitness {
  readonly vkey: HexString;
  readonly signature: HexString;
}

export interface BootstrapWitness {
  readonly publicKey: HexString;
  readonly signature: HexString;
  readonly chainCode: HexString;
  readonly attributes: HexString;
}

export interface PlutusData {
  readonly data: any; // CBOR-encoded plutus data
}

export interface Redeemer {
  readonly tag: "spend" | "mint" | "cert" | "reward";
  readonly index: number;
  readonly data: PlutusData;
  readonly exUnits: ExUnits;
}

export interface ExUnits {
  readonly mem: number;
  readonly steps: number;
}

// UTXO Selection types
export interface UTXOSelectionResult {
  readonly selectedUTXOs: UTXO[];
  readonly totalSelected: Lovelace;
  readonly change: Lovelace;
  readonly fee: Lovelace;
}

export interface UTXOSelectionStrategy {
  readonly name: string;
  readonly description: string;
  select(
    utxos: UTXO[],
    targetAmount: Lovelace,
    feeEstimate: Lovelace,
  ): UTXOSelectionResult;
}

// Cryptographic types
export interface KeyPair {
  readonly privateKey: Uint8Array;
  readonly publicKey: Uint8Array;
}

export interface ExtendedKey {
  readonly key: Uint8Array;
  readonly chainCode: Uint8Array;
  readonly depth: number;
  readonly parentFingerprint: number;
  readonly childIndex: number;
}

export interface DerivationPath {
  readonly purpose: number;
  readonly coinType: number;
  readonly account: number;
  readonly change: number;
  readonly addressIndex: number;
}

export interface Mnemonic {
  readonly words: string[];
  readonly passphrase?: string;
}

// Serialization types
export interface SerializableTransaction {
  readonly type: "unsigned" | "signed";
  readonly serialized: HexString;
  readonly metadata?: any;
}


// Configuration types
export interface CardanoConfig {
  readonly network: NetworkType;
  readonly protocolParameters: ProtocolParameters;
  readonly endpoints: NetworkEndpoints;
  readonly features: FeatureFlags;
}

// Protocol parameters (TyphonJS-compatible structure)
export interface ProtocolParameters {
  readonly minFeeA: number;
  readonly minFeeB: number;
  readonly maxTxSize: number;
  readonly utxoCostPerWord: Lovelace;
  readonly minUtxo: Lovelace;
  readonly poolDeposit: Lovelace;
  readonly keyDeposit: Lovelace;
  readonly maxValSize: number;
  readonly maxTxExMem: number;
  readonly maxTxExSteps: number;
  // TyphonJS requires these additional parameters
  readonly coinsPerUtxoWord?: number;
  readonly maxCollateralInputs?: number;
  readonly collateralPercent?: number;
  readonly priceMem?: number;
  readonly priceStep?: number;
}

// TyphonJS-compatible protocol parameters for transaction building
export interface TyphonProtocolParams {
  readonly minFeeA: number;
  readonly minFeeB: number;
  readonly maxTxSize: number;
  readonly coinsPerUtxoWord: number;
  readonly poolDeposit: bigint;
  readonly keyDeposit: bigint;
  readonly maxValSize: number;
  readonly maxCollateralInputs: number;
  readonly collateralPercent: number;
  readonly priceMem: number;
  readonly priceStep: number;
}

export interface NetworkEndpoints {
  readonly blockfrost?: string;
  readonly koios?: string;
  readonly cardanoGraphQL?: string;
  readonly submit?: string;
}

export interface FeatureFlags {
  readonly plutusScripts: boolean;
  readonly nativeTokens: boolean;
  readonly metadata: boolean;
  readonly multisig: boolean;
}

// Security types
export interface SecurityContext {
  readonly rateLimit: RateLimitConfig;
  readonly validation: ValidationConfig;
  readonly sanitization: SanitizationConfig;
}

export interface RateLimitConfig {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly skipSuccessfulRequests: boolean;
}

export interface ValidationConfig {
  readonly strictMode: boolean;
  readonly allowedPatterns: RegExp[];
  readonly blockedPatterns: RegExp[];
}

export interface SanitizationConfig {
  readonly maxInputLength: number;
  readonly allowEmptyStrings: boolean;
  readonly normalizeWhitespace: boolean;
}

// Account and Address types
export interface Account {
  readonly address: Address;
  readonly balance: Lovelace;
  readonly assets: MultiAsset;
  readonly utxos: UTXO[];
  readonly delegations?: Delegation[];
  readonly rewards?: Lovelace;
}

export interface Delegation {
  readonly poolId: string;
  readonly epoch: number;
  readonly active: boolean;
}

export interface AddressInfo {
  readonly type: "byron" | "shelley";
  readonly networkId: number;
  readonly paymentCredential?: Credential;
  readonly stakeCredential?: Credential;
}

export interface Credential {
  readonly type: "key" | "script";
  readonly hash: HexString;
}

// Error types
export interface CardanoError {
  readonly code: string;
  readonly message: string;
  readonly details?: any;
  readonly recoverable: boolean;
}

export interface ValidationError extends CardanoError {
  readonly field: string;
  readonly value: any;
  readonly constraint: string;
}

export interface CryptoError extends CardanoError {
  readonly operation: string;
  readonly inputLength?: number;
}

export interface NetworkError extends CardanoError {
  readonly endpoint: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
}

// Utility types
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
