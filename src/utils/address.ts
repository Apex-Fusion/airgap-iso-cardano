import { ValidationError } from "../errors/error-types";
import { address as TyphonAddress, utils as TyphonUtils, types as TyphonTypes } from "@stricahq/typhonjs";
import { PublicKey } from "@stricahq/bip32ed25519";
import { Buffer } from "buffer";

/**
 * Cardano address utility class using cardano-crypto.js native functions (CIP-19 compliant)
 */
export class CardanoAddress {

  /**
   * Generate enterprise address from payment key using CIP-19 specification
   */
  static async fromPaymentKey(
    paymentKey: Uint8Array,
    network: "mainnet" | "testnet" = "mainnet",
  ): Promise<string> {
    return await this.fromPublicKey(paymentKey, network);
  }

  /**
   * Generate a Cardano address from a public key using optimized TyphonJS
   */
  static async fromPublicKey(
    publicKey: Uint8Array,
    network: "mainnet" | "testnet" = "mainnet",
  ): Promise<string> {
    try {
      if (!publicKey || publicKey.length !== 32) {
        throw new Error("Public key must be exactly 32 bytes");
      }

      // Optimized: Use TyphonJS streamlined approach
      const pubKey = new PublicKey(Buffer.from(publicKey));
      const keyHash = pubKey.hash();
      const networkId = network === "mainnet" ? TyphonTypes.NetworkId.MAINNET : TyphonTypes.NetworkId.TESTNET;
      
      // Simplified credential creation
      const paymentCredential = { type: 0, hash: keyHash };
      const enterpriseAddr = new TyphonAddress.EnterpriseAddress(networkId, paymentCredential);
      
      return enterpriseAddr.getBech32();
    } catch (error) {
      throw ValidationError.invalidAddress("", `Failed to generate address: ${error}`);
    }
  }

  /**
   * Generate base address from payment and stake keys using pure JavaScript TyphonJS
   */
  static async fromPaymentAndStakeKeys(
    paymentKey: Uint8Array,
    stakeKey: Uint8Array,
    network: "mainnet" | "testnet" = "mainnet",
  ): Promise<string> {
    try {
      if (!paymentKey || paymentKey.length !== 32) {
        throw new Error("Payment key must be exactly 32 bytes");
      }
      if (!stakeKey || stakeKey.length !== 32) {
        throw new Error("Stake key must be exactly 32 bytes");
      }

      // Generate key hashes using TyphonJS
      const paymentPubKey = new PublicKey(Buffer.from(paymentKey));
      const stakePubKey = new PublicKey(Buffer.from(stakeKey));
      const paymentKeyHash = paymentPubKey.hash();
      const stakeKeyHash = stakePubKey.hash();
      
      // Network ID: TyphonJS uses MAINNET = 1, TESTNET = 0
      const networkId = network === "mainnet" ? TyphonTypes.NetworkId.MAINNET : TyphonTypes.NetworkId.TESTNET;
      
      // Create base address using TyphonJS (payment key + stake key)
      const paymentCredential = {
        type: 0, // Key hash credential
        hash: paymentKeyHash
      };
      const stakeCredential = {
        type: 0, // Key hash credential
        hash: stakeKeyHash
      };
      
      const baseAddr = new TyphonAddress.BaseAddress(
        networkId,
        paymentCredential,
        stakeCredential
      );
      
      // Get bech32 address
      return baseAddr.getBech32();
    } catch (error) {
      throw ValidationError.invalidAddress("", `Failed to generate base address: ${error}`);
    }
  }

  /**
   * Generate reward address from stake key using pure JavaScript TyphonJS
   */
  static async fromStakeKey(
    stakeKey: Uint8Array,
    network: "mainnet" | "testnet" = "mainnet",
  ): Promise<string> {
    try {
      if (!stakeKey || stakeKey.length !== 32) {
        throw new Error("Stake key must be exactly 32 bytes");
      }

      // Generate stake key hash using TyphonJS
      const stakePubKey = new PublicKey(Buffer.from(stakeKey));
      const stakeKeyHash = stakePubKey.hash();
      
      // Network ID: TyphonJS uses MAINNET = 1, TESTNET = 0
      const networkId = network === "mainnet" ? TyphonTypes.NetworkId.MAINNET : TyphonTypes.NetworkId.TESTNET;
      
      // Create reward address using TyphonJS (stake key only)
      const stakeCredential = {
        type: 0, // Key hash credential
        hash: stakeKeyHash
      };
      
      const rewardAddr = new TyphonAddress.RewardAddress(
        networkId,
        stakeCredential
      );
      
      // Get bech32 address
      return rewardAddr.getBech32();
    } catch (error) {
      throw ValidationError.invalidAddress("", `Failed to generate reward address: ${error}`);
    }
  }

  /**
   * Validate a Cardano address using pure JavaScript TyphonJS utilities
   */
  static async validate(address: string): Promise<boolean> {
    try {
      if (!address || typeof address !== "string") {
        return false;
      }

      // Use TyphonJS utils for address validation
      try {
        const cardanoAddr = TyphonUtils.getAddressFromString(address);
        return cardanoAddr !== null && cardanoAddr !== undefined;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Validate Byron legacy address (simple prefix check)
   */
  static validateByronAddress(address: string): boolean {
    try {
      if (!address || typeof address !== "string") {
        return false;
      }
      
      // Byron addresses start with specific prefixes
      return address.startsWith("Ddz") || address.startsWith("Ae2");
    } catch {
      return false;
    }
  }

  /**
   * Validate Shelley address using bech32 validation
   */
  static async validateShelleyAddress(address: string): Promise<boolean> {
    try {
      if (!address || typeof address !== "string") {
        return false;
      }
      
      // Shelley addresses start with addr or addr_test
      return address.startsWith("addr") && await this.validate(address);
    } catch {
      return false;
    }
  }

  /**
   * Validate stake address using prefix check
   */
  static async validateStakeAddress(address: string): Promise<boolean> {
    try {
      if (!address || typeof address !== "string") {
        return false;
      }
      
      // Stake addresses start with stake or stake_test
      return address.startsWith("stake") && await this.validate(address);
    } catch {
      return false;
    }
  }

  /**
   * Validate script address according to CIP-19 specification
   * @implements CIP-19 - Complete script address validation
   */
  static async validateScriptAddress(address: string): Promise<boolean> {
    try {
      if (!address || typeof address !== "string") {
        return false;
      }
      
      // Use TyphonJS to parse and validate script address
      const cardanoAddr = TyphonUtils.getAddressFromString(address);
      if (!cardanoAddr) {
        return false;
      }
      
      // Check if it's actually a script address by examining the credential type
      const addressType = await this.getAddressType(address);
      
      // Script addresses can be Enterprise or Base addresses with script credentials
      if (addressType === "enterprise" || addressType === "base") {
        return await this.hasScriptCredential(address);
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check if address has script credential
   * @implements CIP-19 - Script credential detection
   */
  static async hasScriptCredential(address: string): Promise<boolean> {
    try {
      const cardanoAddr = TyphonUtils.getAddressFromString(address);
      if (!cardanoAddr) {
        return false;
      }

      // Check payment credential type for Enterprise and Base addresses
      if ('paymentCredential' in cardanoAddr) {
        const paymentCredential = (cardanoAddr as any).paymentCredential;
        // Script credential type is 1, key credential type is 0
        return paymentCredential && paymentCredential.type === 1;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get network type from address using prefix analysis
   */
  static async getNetwork(address: string): Promise<"mainnet" | "testnet" | null> {
    try {
      if (!(await this.validate(address))) {
        return null;
      }

      // Mainnet addresses: addr1, stake1
      // Testnet addresses: addr_test1, stake_test1
      if (address.startsWith("addr1") || address.startsWith("stake1")) {
        return "mainnet";
      } else if (address.startsWith("addr_test") || address.startsWith("stake_test")) {
        return "testnet";
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Extract address type from address using pure JavaScript TyphonJS utilities
   */
  static async getAddressType(address: string): Promise<string | null> {
    try {
      if (!(await this.validate(address))) {
        return null;
      }

      // Use TyphonJS utils to parse address and determine type
      const cardanoAddr = TyphonUtils.getAddressFromString(address);
      
      if (!cardanoAddr) {
        return null;
      }
      
      // Determine type based on TyphonJS address object
      if (cardanoAddr instanceof TyphonAddress.BaseAddress) {
        return "base";
      } else if (cardanoAddr instanceof TyphonAddress.EnterpriseAddress) {
        return "enterprise";
      } else if (cardanoAddr instanceof TyphonAddress.RewardAddress) {
        return "reward";
      } else if (cardanoAddr instanceof TyphonAddress.ByronAddress) {
        return "byron";
      } else if (cardanoAddr instanceof TyphonAddress.PointerAddress) {
        return "pointer";
      } else {
        return "unknown";
      }
    } catch {
      return null;
    }
  }

  /**
   * Check if address is a reward address using prefix check
   */
  static async isRewardAddress(address: string): Promise<boolean> {
    try {
      return address.startsWith("stake") && await this.validate(address);
    } catch {
      return false;
    }
  }

  /**
   * Check if address is a base address (simplified check)
   */
  static async isBaseAddress(address: string): Promise<boolean> {
    try {
      return await this.getAddressType(address) === "base";
    } catch {
      return false;
    }
  }

  /**
   * Check if address is an enterprise address (simplified check)
   */
  static async isEnterpriseAddress(address: string): Promise<boolean> {
    try {
      return await this.getAddressType(address) === "enterprise";
    } catch {
      return false;
    }
  }

  /**
   * Check if address belongs to specified network
   */
  static async isNetworkCompatible(address: string, expectedNetwork: "mainnet" | "testnet"): Promise<boolean> {
    const addressNetwork = await this.getNetwork(address);
    return addressNetwork === expectedNetwork;
  }


  /**
   * Secure comparison of two addresses
   */
  static secureCompare(address1: string, address2: string): boolean {
    if (!address1 || !address2 || address1.length !== address2.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < address1.length; i++) {
      result |= address1.charCodeAt(i) ^ address2.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Sanitize address input
   */
  static async sanitize(address: string): Promise<string> {
    if (!address || typeof address !== "string") {
      throw ValidationError.invalidAddress("", "Address must be a non-empty string");
    }

    // Remove whitespace but preserve case for bech32
    const cleaned = address.trim();

    // Validate using official SDK validation
    if (!(await this.validate(cleaned))) {
      throw ValidationError.invalidAddress(cleaned, "Invalid address format");
    }

    // Prevent extremely long addresses (potential DoS)
    if (cleaned.length > 200) {
      throw ValidationError.invalidAddress(cleaned, "Address too long");
    }

    return cleaned;
  }

  // =================== Multi-Asset Support Methods ===================

  /**
   * Validate if address can hold native assets (multi-asset support)
   * @implements CIP-19 - Multi-asset capability detection
   */
  static async supportsMultiAsset(address: string): Promise<boolean> {
    try {
      const addressType = await this.getAddressType(address);
      
      // All Shelley-era addresses support multi-asset
      // Byron addresses do not support native assets
      return addressType !== "byron" && addressType !== null;
    } catch {
      return false;
    }
  }

  /**
   * Extract credential information from address
   * @implements CIP-19 - Credential extraction for multi-asset handling
   */
  static async extractCredentials(address: string): Promise<{
    paymentCredential?: { type: number; hash: Uint8Array };
    stakeCredential?: { type: number; hash: Uint8Array };
  } | null> {
    try {
      const cardanoAddr = TyphonUtils.getAddressFromString(address);
      if (!cardanoAddr) {
        return null;
      }

      const result: any = {};

      // Extract payment credential
      if ('paymentCredential' in cardanoAddr) {
        const paymentCred = (cardanoAddr as any).paymentCredential;
        if (paymentCred) {
          result.paymentCredential = {
            type: paymentCred.type || 0,
            hash: new Uint8Array(paymentCred.hash || [])
          };
        }
      }

      // Extract stake credential (for Base and Pointer addresses)
      if ('stakeCredential' in cardanoAddr) {
        const stakeCred = (cardanoAddr as any).stakeCredential;
        if (stakeCred) {
          result.stakeCredential = {
            type: stakeCred.type || 0,
            hash: new Uint8Array(stakeCred.hash || [])
          };
        }
      }

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Check if address can be used for staking operations
   * @implements CIP-19 - Staking capability detection
   */
  static async canStake(address: string): Promise<boolean> {
    try {
      const addressType = await this.getAddressType(address);
      
      // Base, Pointer, and Reward addresses support staking
      // Enterprise and Byron addresses do not
      return addressType === "base" || 
             addressType === "pointer" || 
             addressType === "reward";
    } catch {
      return false;
    }
  }

  /**
   * Generate script address from script hash
   * @implements CIP-19 - Script address generation for multi-asset
   */
  static async fromScriptHash(
    scriptHash: Uint8Array,
    network: "mainnet" | "testnet" = "mainnet",
    includeStakeCredential?: { type: number; hash: Uint8Array }
  ): Promise<string> {
    try {
      if (!scriptHash || scriptHash.length !== 28) {
        throw new Error("Script hash must be exactly 28 bytes");
      }

      const networkId = network === "mainnet" ? TyphonTypes.NetworkId.MAINNET : TyphonTypes.NetworkId.TESTNET;
      
      // Create script credential
      const scriptCredential = {
        type: 1, // Script credential type
        hash: Buffer.from(scriptHash)
      };

      let address;

      if (includeStakeCredential) {
        // Create base script address (script + stake)
        const stakeCredential = {
          type: includeStakeCredential.type,
          hash: Buffer.from(includeStakeCredential.hash)
        };
        
        address = new TyphonAddress.BaseAddress(
          networkId,
          scriptCredential,
          stakeCredential
        );
      } else {
        // Create enterprise script address (script only)
        address = new TyphonAddress.EnterpriseAddress(
          networkId,
          scriptCredential
        );
      }

      return address.getBech32();
    } catch (error) {
      throw ValidationError.invalidAddress("", `Failed to generate script address: ${error}`);
    }
  }

  /**
   * Extract script hash from script address
   * @implements CIP-19 - Script hash extraction
   */
  static async extractScriptHash(address: string): Promise<Uint8Array | null> {
    try {
      if (!(await this.hasScriptCredential(address))) {
        return null;
      }

      const credentials = await this.extractCredentials(address);
      if (!credentials?.paymentCredential) {
        return null;
      }

      return credentials.paymentCredential.hash;
    } catch {
      return null;
    }
  }

  /**
   * Check if two addresses are equivalent (same credentials)
   * @implements CIP-19 - Address equivalence checking
   */
  static async areEquivalent(address1: string, address2: string): Promise<boolean> {
    try {
      if (address1 === address2) {
        return true;
      }

      const creds1 = await this.extractCredentials(address1);
      const creds2 = await this.extractCredentials(address2);

      if (!creds1 || !creds2) {
        return false;
      }

      // Compare payment credentials
      if (creds1.paymentCredential && creds2.paymentCredential) {
        const paymentMatch = 
          creds1.paymentCredential.type === creds2.paymentCredential.type &&
          this.arraysEqual(creds1.paymentCredential.hash, creds2.paymentCredential.hash);
        
        if (!paymentMatch) {
          return false;
        }
      } else if (creds1.paymentCredential !== creds2.paymentCredential) {
        return false;
      }

      // Compare stake credentials (if both present)
      if (creds1.stakeCredential && creds2.stakeCredential) {
        return creds1.stakeCredential.type === creds2.stakeCredential.type &&
               this.arraysEqual(creds1.stakeCredential.hash, creds2.stakeCredential.hash);
      }

      // If only one has stake credential, they're not equivalent
      return !creds1.stakeCredential && !creds2.stakeCredential;
    } catch {
      return false;
    }
  }

  /**
   * Helper method to compare byte arrays
   */
  private static arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}
