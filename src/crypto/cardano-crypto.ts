/**
 * Cardano Crypto utilities using pure JavaScript libraries
 * WebView-compatible implementation for AirGap isolated modules
 * 
 * CIP Compliance:
 * - CIP-3: Wallet Key Generation (Icarus master node derivation)
 * - CIP-1852: HD Wallets for Cardano (purpose 1852', coin type 1815')
 * - CIP-19: Cardano Addresses (Blake2b-224 hashes, Ed25519 verification keys)
 * - CIP-8: Message Signing (Ed25519 signatures with Blake2b hashing)
 * 
 * AirGap Protocol Compatibility:
 * - Provides required interfaces for AirGap Vault integration
 * - Uses 2019-2021 era libraries compatible with restrictive WebView
 * - Includes utility methods for hex conversion and key derivation
 */

import { generateMnemonic, mnemonicToSeed, validateMnemonic, entropyToMnemonic, mnemonicToEntropy } from 'bip39';
import { BLAKE2b } from '@stablelib/blake2b';
import { SHA256 } from '@stablelib/sha256';
import { Buffer } from 'buffer';
import Bip32PrivateKey from '@stricahq/bip32ed25519/dist/Bip32PrivateKey';
import PublicKey from '@stricahq/bip32ed25519/dist/PublicKey';
import { crypto as TyphonCrypto } from '@stricahq/typhonjs';
import { CryptoOperationError, ErrorCode } from '../errors/error-types';
import { HARDENED_OFFSET, CIP1852_DERIVATION } from '../types/domain';

/**
 * Helper function for hardened derivation in BIP32 paths
 * Uses standardized hardened derivation offset constant
 */
export function harden(num: number): number {
  return HARDENED_OFFSET + num;
}

export class CardanoCrypto {
  /**
   * Generate a cryptographically secure 24-word BIP39 mnemonic
   * 
   * @implements CIP-3 - Uses BIP39 standard for mnemonic generation
   * @returns 24-word mnemonic (256 bits entropy) as per Cardano standards
   */
  static generateMnemonic(): string[] {
    try {
      // Use legacy bip39 for AirGap compatibility with 24 words (256 bits entropy)
      const mnemonic = generateMnemonic(256);
      return mnemonic.split(' ');
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to generate mnemonic: ${error}`);
    }
  }

  /**
   * Convert entropy to BIP39 mnemonic
   */
  static entropyToMnemonic(entropy: Uint8Array): string[] {
    try {
      if (entropy.length !== 32) {
        throw new Error('Entropy must be 32 bytes for 24-word mnemonic');
      }
      
      // Use legacy bip39's entropyToMnemonic for proper deterministic conversion
      const mnemonic = entropyToMnemonic(Buffer.from(entropy));
      return mnemonic.split(' ');
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to convert entropy to mnemonic: ${error}`);
    }
  }

  /**
   * Validate BIP39 mnemonic
   */
  static validateMnemonic(mnemonic: string[]): boolean {
    try {
      const mnemonicStr = mnemonic.join(' ');
      return validateMnemonic(mnemonicStr);
    } catch {
      return false;
    }
  }

  /**
   * Convert mnemonic to cryptographic seed using PBKDF2
   * 
   * @implements CIP-3 - Uses BIP39 PBKDF2 for seed derivation
   * @param mnemonic BIP39 mnemonic words
   * @param passphrase Optional passphrase for additional security
   * @returns 64-byte seed for key derivation
   */
  static async mnemonicToSeed(mnemonic: string[], passphrase: string = ''): Promise<Uint8Array> {
    try {
      const mnemonicStr = mnemonic.join(' ');

      if (!validateMnemonic(mnemonicStr)) {
        throw new Error('Invalid mnemonic');
      }

      // Use legacy bip39 for AirGap-compatible seed derivation
      const seed = await mnemonicToSeed(mnemonicStr, passphrase);
      return new Uint8Array(seed);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to derive seed from mnemonic: ${error}`);
    }
  }

  /**
   * Derive Cardano root keypair from mnemonic using pure JavaScript BIP32-Ed25519
   * 
   * @implements CIP-3 - Icarus master node derivation algorithm
   * @implements CIP-1852 - Uses BIP32-Ed25519 for hierarchical deterministic wallets
   * @param mnemonic BIP39 mnemonic words
   * @param passphrase Optional passphrase
   * @returns 128-byte buffer: 96-byte extended private key + 32-byte public key
   */
  static async deriveRootKeypair(mnemonic: string[], passphrase: string = ''): Promise<Uint8Array> {
    try {
      const mnemonicStr = mnemonic.join(' ');
      
      if (!validateMnemonic(mnemonicStr)) {
        throw new Error('Invalid mnemonic');
      }

      // CIP-3 Icarus: Generate master key using PBKDF2 with specific parameters
      // 1. Convert mnemonic to entropy (seed) 
      const entropyHex = mnemonicToEntropy(mnemonicStr);
      const seedBytes = this.hexToUint8Array(entropyHex);
      
      // 2. Use PBKDF2 with:
      //    - salt: entropy from mnemonic (seed)
      //    - password: passphrase (or empty string)
      //    - iterations: 4096
      //    - outputLen: 96 bytes
      const passwordBytes = new TextEncoder().encode(passphrase);
      
      // Use Web Crypto API for PBKDF2 (compatible with AirGap environment)
      const keyMaterial = await crypto.subtle.importKey(
        "raw",
        passwordBytes,
        "PBKDF2",
        false,
        ["deriveBits"]
      );
      
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: seedBytes, // entropy from mnemonic as salt
          iterations: 4096,
          hash: "SHA-512"
        },
        keyMaterial,
        96 * 8 // 96 bytes = 768 bits
      );
      
      const masterKeyData = new Uint8Array(derivedBits);
      
      // CIP-3 Icarus: Apply bit tweaking to the first 32 bytes
      this.tweakBits(masterKeyData);
      
      // Use the tweaked master key data directly as our extended private key
      // (The CIP-3 algorithm produces the final master key, not an input to BIP32)
      const rootKey = new Bip32PrivateKey(Buffer.from(masterKeyData));
      
      // Get the extended private key bytes (96 bytes) and derive public key
      const privateKeyExtended = rootKey.toBytes(); // 96 bytes: 64 extended + 32 chain code
      const publicKey = rootKey.toBip32PublicKey().toBytes(); // 32 bytes
      
      // Create 128-byte buffer for compatibility (96 bytes private extended + 32 bytes public)
      const fullKeypair = new Uint8Array(128);
      fullKeypair.set(privateKeyExtended.slice(0, 96), 0);  // Extended private key (96 bytes)
      fullKeypair.set(publicKey.slice(0, 32), 96);          // Public key (32 bytes)
      
      return fullKeypair;
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to derive root keypair: ${error}`);
    }
  }

  /**
   * CIP-3 Icarus bit tweaking for Ed25519 scalar
   * 
   * @implements CIP-3 - Bit tweaking algorithm from Icarus specification
   * @param data 96-byte master key data to tweak (modifies in place)
   */
  private static tweakBits(data: Uint8Array): void {
    // On the ed25519 scalar leftmost 32 bytes:
    // * clear the lowest 3 bits
    // * clear the highest bit  
    // * clear the 3rd highest bit
    // * set the highest 2nd bit
    data[0]  &= 0b1111_1000;  // Clear lowest 3 bits
    data[31] &= 0b0001_1111;  // Clear highest bit and 3rd highest bit
    data[31] |= 0b0100_0000;  // Set 2nd highest bit
  }

  /**
   * Derive child keypair from parent using Cardano derivation path
   * 
   * @implements CIP-1852 - Hierarchical deterministic key derivation
   * @param parentKeypair 128-byte parent keypair
   * @param path BIP32 derivation path (e.g., "m/1852'/1815'/0'/0/0")
   * @returns 128-byte child keypair
   */
  static async deriveChildKeypair(parentKeypair: ArrayLike<number>, path: string): Promise<Uint8Array> {
    try {
      // Parse Cardano derivation path (e.g., "m/1852'/1815'/0'/0/0")
      const pathSegments = path.split('/').slice(1); // Remove 'm' prefix
      
      // Extract the extended private key from the 128-byte parent keypair (first 96 bytes)
      const parentKeypairUint8 = new Uint8Array(parentKeypair);
      const parentPrivateKeyBytes = parentKeypairUint8.slice(0, 96);
      
      // Create BIP32 private key from the parent private key bytes  
      let currentKey = new Bip32PrivateKey(Buffer.from(parentPrivateKeyBytes));
      
      for (const segment of pathSegments) {
        const isHardened = segment.endsWith("'");
        const index = parseInt(isHardened ? segment.slice(0, -1) : segment);
        
        // Use BIP32-Ed25519 derive method with proper hardened/soft derivation
        if (isHardened) {
          currentKey = currentKey.deriveHardened(index);
        } else {
          currentKey = currentKey.derive(index);
        }
      }
      
      // Return 128-byte format for compatibility
      const privateKeyExtended = currentKey.toBytes(); // 96 bytes
      const publicKey = currentKey.toBip32PublicKey().toBytes(); // 32 bytes
      
      const fullKeypair = new Uint8Array(128);
      fullKeypair.set(privateKeyExtended.slice(0, 96), 0);  // Extended private key (96 bytes)
      fullKeypair.set(publicKey.slice(0, 32), 96);          // Public key (32 bytes)
      
      return fullKeypair;
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to derive child keypair: ${error}`);
    }
  }

  /**
   * Derive payment keypair from mnemonic using CIP-1852 derivation path
   * 
   * @implements CIP-1852 - Standard path: m/1852'/1815'/account'/0/address_index
   * @param mnemonic BIP39 mnemonic words
   * @param accountIndex Account index (usually 0)
   * @param addressIndex Address index (0-based)
   * @param passphrase Optional passphrase
   * @returns 128-byte payment keypair
   */
  static async derivePaymentKeypair(
    mnemonic: string[], 
    accountIndex: number = 0, 
    addressIndex: number = 0,
    passphrase: string = ''
  ): Promise<Uint8Array> {
    try {
      const rootKeypair = await this.deriveRootKeypair(mnemonic, passphrase);
      const paymentPath = `m/${CIP1852_DERIVATION.PURPOSE}'/${CIP1852_DERIVATION.COIN_TYPE}'/${accountIndex}'/0/${addressIndex}`;
      return await this.deriveChildKeypair(rootKeypair, paymentPath);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to derive payment keypair: ${error}`);
    }
  }

  /**
   * Derive stake keypair from mnemonic using CIP-1852 derivation path
   * 
   * @implements CIP-1852 - Standard path: m/1852'/1815'/account'/2/0
   * @implements CIP-11 - Staking key chain for HD wallets
   * @param mnemonic BIP39 mnemonic words
   * @param accountIndex Account index (usually 0)
   * @param passphrase Optional passphrase
   * @returns 128-byte stake keypair
   */
  static async deriveStakeKeypair(
    mnemonic: string[], 
    accountIndex: number = 0,
    passphrase: string = ''
  ): Promise<Uint8Array> {
    try {
      const rootKeypair = await this.deriveRootKeypair(mnemonic, passphrase);
      const stakePath = `m/${CIP1852_DERIVATION.PURPOSE}'/${CIP1852_DERIVATION.COIN_TYPE}'/${accountIndex}'/${CIP1852_DERIVATION.STAKE_KEY}/0`;
      return await this.deriveChildKeypair(rootKeypair, stakePath);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to derive stake keypair: ${error}`);
    }
  }

  /**
   * Get public key from keypair buffer (bytes 96-127)
   */
  static getPublicKey(keypair: ArrayLike<number>): Uint8Array {
    try {
      const keypairUint8 = new Uint8Array(keypair);
      if (!keypairUint8 || keypairUint8.length !== 128) {
        throw new Error('Invalid keypair buffer: must be 128 bytes');
      }
      // Public key is stored in bytes 96-127 of the 128-byte buffer (32 bytes)
      return keypairUint8.slice(96, 128);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.INVALID_PUBLIC_KEY, `Failed to get public key: ${error}`);
    }
  }

  /**
   * Get private key from keypair buffer (extract 32-byte signing key from extended key)
   */
  static getPrivateKey(keypair: ArrayLike<number>): Uint8Array {
    try {
      const keypairUint8 = new Uint8Array(keypair);
      if (!keypairUint8 || keypairUint8.length !== 128) {
        throw new Error('Invalid keypair buffer: must be 128 bytes');
      }
      // Extract the 32-byte signing key from the extended private key (first 96 bytes)
      const extendedPrivateKey = keypairUint8.slice(0, 96);
      const bip32Key = new Bip32PrivateKey(Buffer.from(extendedPrivateKey));
      const signingKey = bip32Key.toPrivateKey();
      const signingKeyBytes = new Uint8Array(signingKey.toBytes());
      
      // The signing key might be 64 bytes (32 bytes key + 32 bytes IV), we need just the first 32 bytes
      return signingKeyBytes.slice(0, 32);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.INVALID_PRIVATE_KEY, `Failed to get private key: ${error}`);
    }
  }

  /**
   * Sign transaction using pure JavaScript Ed25519
   * 
   * @implements CIP-8 - Message signing with Ed25519 signatures
   * @param txHash Transaction hash to sign
   * @param privateKeyOrKeypair 128-byte keypair for compatibility
   * @returns Ed25519 signature (64 bytes)
   */
  static async signTransaction(txHash: Uint8Array, privateKeyOrKeypair: Uint8Array): Promise<Uint8Array> {
    try {
      if (!txHash || txHash.length === 0) {
        throw new Error('Transaction hash cannot be empty');
      }

      // Maintain compatibility: expect full 128-byte keypair
      if (privateKeyOrKeypair.length === 32) {
        throw new Error('Sign requires full 128-byte keypair, not just 32-byte private key. Use signWithKeypair instead.');
      }

      if (privateKeyOrKeypair.length !== 128) {
        throw new Error(`Invalid keypair length: expected 128 bytes, got ${privateKeyOrKeypair.length} bytes`);
      }

      // Extract the extended private key from the 128-byte keypair (first 96 bytes)
      const extendedPrivateKeyBytes = privateKeyOrKeypair.slice(0, 96);
      
      // Create BIP32 private key and extract the signing key
      const bip32Key = new Bip32PrivateKey(Buffer.from(extendedPrivateKeyBytes));
      const signingKey = bip32Key.toPrivateKey();
      
      // Sign the transaction hash
      const signature = signingKey.sign(Buffer.from(txHash));
      
      return new Uint8Array(signature);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.SIGNATURE_FAILED, `Failed to sign transaction: ${error}`);
    }
  }

  /**
   * Sign transaction using pure JavaScript Ed25519 with full keypair
   */
  static async signWithKeypair(txHash: Uint8Array, keypair: Uint8Array): Promise<Uint8Array> {
    try {
      if (!txHash || txHash.length === 0) {
        throw new Error('Transaction hash cannot be empty');
      }

      if (keypair.length !== 128) {
        throw new Error(`Invalid keypair length: expected 128 bytes, got ${keypair.length} bytes`);
      }

      // Extract the extended private key from the 128-byte keypair (first 96 bytes)
      const extendedPrivateKeyBytes = keypair.slice(0, 96);
      
      // Create BIP32 private key and extract the signing key
      const bip32Key = new Bip32PrivateKey(Buffer.from(extendedPrivateKeyBytes));
      const signingKey = bip32Key.toPrivateKey();
      
      // Sign the transaction hash
      const signature = signingKey.sign(Buffer.from(txHash));
      
      return new Uint8Array(signature);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.SIGNATURE_FAILED, `Failed to sign with keypair: ${error}`);
    }
  }

  /**
   * Verify signature using pure JavaScript Ed25519
   */
  static async verifySignature(
    signature: Uint8Array,
    data: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean> {
    try {
      if (!data || data.length === 0) {
        return false;
      }

      // Create public key object and verify signature properly
      const pubKey = new PublicKey(Buffer.from(publicKey));
      
      // Use the public key's verify method directly
      return pubKey.verify(Buffer.from(signature), Buffer.from(data));
    } catch {
      return false;
    }
  }

  /**
   * Generate cryptographically secure random bytes using Web Crypto API
   */
  static generateRandomBytes(length: number): Uint8Array {
    try {
      if (length <= 0 || length > 1024) {
        throw new Error('Invalid length: must be between 1 and 1024');
      }

      // Use Web Crypto API (JavascriptEngine compatible)
      const randomBytes = new Uint8Array(length);
      crypto.getRandomValues(randomBytes);
      return randomBytes;
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to generate random bytes: ${error}`);
    }
  }

  /**
   * Hash data using Blake2b (Cardano standard) - enhanced with TyphonJS for common lengths
   * 
   * @implements CIP-19 - Blake2b-224 for key hashes, Blake2b-256 for general hashing
   * @param data Data to hash
   * @param outputLength Hash output length (28, 32, or 64 bytes)
   * @returns Blake2b hash
   */
  static hashBlake2b(data: Uint8Array, outputLength: number = 32): Uint8Array {
    try {
      if (outputLength === 32) {
        // Use TyphonJS for 32-byte hashes (Blake2b-256)
        const hash = TyphonCrypto.hash32(Buffer.from(data));
        return new Uint8Array(hash);
      } else if (outputLength === 28) {
        // Use TyphonJS for 28-byte hashes (Blake2b-224) - Cardano key hashes
        const hash = TyphonCrypto.hash28(Buffer.from(data));
        return new Uint8Array(hash);
      } else if (outputLength === 64) {
        // Support 64-byte hashes for Ed25519 extended key generation
        // Use @stablelib for non-Cardano specific lengths
        const hasher = new BLAKE2b(outputLength);
        hasher.update(data);
        return hasher.digest();
      } else {
        // Only support standard Cardano lengths (28, 32) and Ed25519 length (64)
        throw new CryptoOperationError(
          ErrorCode.SIGNATURE_FAILED, 
          `Unsupported hash length: ${outputLength}. Supported lengths: 28, 32, 64 bytes.`
        );
      }
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.SIGNATURE_FAILED, `Failed to hash data with Blake2b: ${error}`);
    }
  }

  /**
   * Create payment key hash for Cardano address generation (Blake2b-224) using TyphonJS
   * 
   * @implements CIP-19 - PaymentKeyHash using Blake2b-224 hash of Ed25519 verification key
   * @param publicKey 32-byte Ed25519 public key
   * @returns 28-byte Blake2b-224 hash for address generation
   */
  static createPaymentKeyHash(publicKey: Uint8Array): Uint8Array {
    try {
      if (!publicKey || publicKey.length !== 32) {
        throw new Error("Invalid public key length");
      }

      // Use TyphonJS optimized Blake2b-224 for Cardano key hashes
      const hash = TyphonCrypto.hash28(Buffer.from(publicKey));
      return new Uint8Array(hash);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to create payment key hash: ${error}`);
    }
  }

  /**
   * Create stake key hash for Cardano address generation (Blake2b-224) using TyphonJS
   * 
   * @implements CIP-19 - StakeKeyHash using Blake2b-224 hash of Ed25519 verification key
   * @param stakeKey 32-byte Ed25519 stake public key
   * @returns 28-byte Blake2b-224 hash for stake address generation
   */
  static createStakeKeyHash(stakeKey: Uint8Array): Uint8Array {
    try {
      if (!stakeKey || stakeKey.length !== 32) {
        throw new Error("Invalid stake key length");
      }

      // Use TyphonJS optimized Blake2b-224 for Cardano key hashes
      const hash = TyphonCrypto.hash28(Buffer.from(stakeKey));
      return new Uint8Array(hash);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.KEY_DERIVATION_FAILED, `Failed to create stake key hash: ${error}`);
    }
  }

  /**
   * Hash data using SHA256 using @stablelib/sha256
   */
  static hash256(data: Uint8Array): Uint8Array {
    try {
      // Use @stablelib/sha256 for AirGap compatibility (no Web Crypto API)
      const hasher = new SHA256();
      hasher.update(data);
      return hasher.digest();
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.SIGNATURE_FAILED, `Failed to hash data: ${error}`);
    }
  }

  /**
   * Hash data using SHA512 using Web Crypto API
   */
  static async hash512(data: Uint8Array): Promise<Uint8Array> {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-512', data);
      return new Uint8Array(hashBuffer);
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.SIGNATURE_FAILED, `Failed to hash data: ${error}`);
    }
  }

  /**
   * Secure memory cleanup (zero out sensitive data)
   */
  static secureWipe(buffer: Uint8Array): void {
    if (buffer && buffer.length > 0) {
      buffer.fill(0);
    }
  }

  // Utility methods for AirGap protocol compatibility

  /**
   * Convert hex string to Uint8Array
   * 
   * @param hex Hexadecimal string to convert
   * @returns Uint8Array containing the decoded bytes
   */
  static hexToUint8Array(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  // stringToUint8Array removed - use polyfilled TextEncoder instead


  /**
   * Derive public key from private key for AirGap protocol compatibility
   * 
   * @implements AirGap protocol interface requirement
   * @param privateKeyBuffer 128-byte keypair or 32-byte private key  
   * @returns Buffer containing 32-byte Ed25519 public key
   */
  static derivePublicKeyFromPrivateKey(privateKeyBuffer: ArrayLike<number>): Buffer {
    try {
      const privateKeyUint8 = new Uint8Array(privateKeyBuffer);
      
      if (privateKeyUint8.length === 128) {
        // If we have a full 128-byte keypair, extract the public key
        const publicKey = this.getPublicKey(privateKeyUint8);
        return Buffer.from(publicKey);
      } else if (privateKeyUint8.length === 32) {
        // For a 32-byte private key, we cannot properly derive the Ed25519 public key
        // without the full extended key context. This is a limitation.
        // Return a warning in development environments.
        throw new Error('Cannot derive Ed25519 public key from 32-byte private key without extended key context. Use 128-byte keypair format.');
      } else {
        throw new Error(`Invalid private key length: expected 32 bytes or 128 bytes (keypair), got ${privateKeyUint8.length} bytes`);
      }
    } catch (error) {
      throw new CryptoOperationError(ErrorCode.INVALID_PUBLIC_KEY, `Failed to derive public key from private key: ${error}`);
    }
  }

}