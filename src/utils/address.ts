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
   * Validate script address (simplified check)
   */
  static async validateScriptAddress(address: string): Promise<boolean> {
    try {
      if (!address || typeof address !== "string") {
        return false;
      }
      
      // Script addresses follow similar pattern but this is a simplified check
      // Full script address validation would require more detailed analysis
      return await this.validate(address);
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
}
