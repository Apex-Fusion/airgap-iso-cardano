/**
 * Mock implementation of @dcspark/cardano-multiplatform-lib-browser for Jest tests
 * This provides the necessary interface to keep tests working while avoiding WASM loading issues
 */

import { BLAKE2b } from '@stablelib/blake2b';
import { Buffer } from 'buffer';

// Mock Ed25519KeyHash class
class MockEd25519KeyHash {
  constructor(private bytes: Uint8Array) {}
  
  static from_bytes(bytes: Uint8Array): MockEd25519KeyHash {
    return new MockEd25519KeyHash(bytes);
  }
  
  to_bytes(): Uint8Array {
    return this.bytes;
  }
}

// Mock PublicKey class  
class MockPublicKey {
  constructor(private bytes: Uint8Array) {}
  
  static from_bytes(bytes: Uint8Array): MockPublicKey {
    return new MockPublicKey(bytes);
  }
  
  hash(): MockEd25519KeyHash {
    // Use Blake2b-224 for key hash (28 bytes)
    const hasher = new BLAKE2b(28);
    hasher.update(this.bytes);
    const hash = hasher.digest();
    return new MockEd25519KeyHash(hash);
  }
  
  verify(message: Uint8Array, signature: MockEd25519Signature): boolean {
    // Simple mock verification - in tests we mainly check the interface
    return signature.bytes.length === 64;
  }
  
  to_raw_bytes(): Uint8Array {
    return this.bytes;
  }
}

// Mock PrivateKey class
class MockPrivateKey {
  constructor(private bytes: Uint8Array) {}
  
  static from_extended_bytes(bytes: Uint8Array): MockPrivateKey {
    return new MockPrivateKey(bytes);
  }
  
  sign(message: Uint8Array): MockEd25519Signature {
    // Create a deterministic mock signature based on message hash
    const hasher = new BLAKE2b(64);
    hasher.update(message);
    const hash = hasher.digest();
    return new MockEd25519Signature(hash);
  }
  
  to_raw_bytes(): Uint8Array {
    return this.bytes;
  }
}

// Mock Ed25519Signature class
class MockEd25519Signature {
  constructor(public bytes: Uint8Array) {}
  
  static from_raw_bytes(bytes: Uint8Array): MockEd25519Signature {
    return new MockEd25519Signature(bytes);
  }
  
  to_raw_bytes(): Uint8Array {
    return this.bytes;
  }
}

// Mock Bip32PrivateKey class
class MockBip32PrivateKey {
  constructor(private bytes: Uint8Array) {}
  
  static from_bip39_entropy(entropy: Uint8Array, passphrase: Uint8Array): MockBip32PrivateKey {
    // Create deterministic key from entropy + passphrase
    const combined = new Uint8Array(entropy.length + passphrase.length);
    combined.set(entropy);
    combined.set(passphrase, entropy.length);
    const hasher = new BLAKE2b(64);
    hasher.update(combined);
    const key = hasher.digest();
    return new MockBip32PrivateKey(key);
  }
  
  static from_128_xprv(bytes: Uint8Array): MockBip32PrivateKey {
    return new MockBip32PrivateKey(bytes);
  }
  
  derive(index: number): MockBip32PrivateKey {
    // Simple derivation using hash of current key + index
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, index, false);
    const combined = new Uint8Array(this.bytes.length + 4);
    combined.set(this.bytes);
    combined.set(indexBytes, this.bytes.length);
    const hasher = new BLAKE2b(64);
    hasher.update(combined);
    const derived = hasher.digest();
    return new MockBip32PrivateKey(derived);
  }
  
  to_raw_key(): MockPrivateKey {
    return new MockPrivateKey(this.bytes.slice(0, 32));
  }
  
  to_public(): MockBip32PublicKey {
    // Mock public key derivation
    const hasher = new BLAKE2b(32);
    hasher.update(this.bytes);
    const publicKeyBytes = hasher.digest();
    return new MockBip32PublicKey(publicKeyBytes);
  }
}

// Mock Bip32PublicKey class
class MockBip32PublicKey {
  constructor(private bytes: Uint8Array) {}
  
  to_raw_key(): MockPublicKey {
    return new MockPublicKey(this.bytes);
  }
}

// Mock Credential class
class MockCredential {
  constructor(private keyHash: MockEd25519KeyHash) {}
  
  static new_pub_key(keyHash: MockEd25519KeyHash): MockCredential {
    return new MockCredential(keyHash);
  }
}

// Mock Address classes
class MockAddress {
  constructor(private bytes: Uint8Array) {}
  
  static from_bech32(address: string): MockAddress {
    // Mock validation - reject obviously invalid addresses
    if (!address || address.length < 10) {
      throw new Error('Invalid address');
    }
    if (!address.startsWith('addr') && !address.startsWith('stake')) {
      throw new Error('Invalid address prefix');
    }
    // Simple mock - encode address string as bytes (AirGap compatible)
    const bytes: number[] = [];
    for (let i = 0; i < address.length; i++) {
      const code = address.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else {
        bytes.push(0x3f); // '?' for non-ASCII
      }
    }
    return new MockAddress(new Uint8Array(bytes));
    return new MockAddress(bytes);
  }
  
  to_raw_bytes(): Uint8Array {
    return this.bytes;
  }
  
  kind(): number {
    // Return mock address kind
    return 0; // Base address
  }
}

class MockEnterpriseAddress {
  constructor(private address: MockAddress) {}
  
  static new(networkId: number, credential: MockCredential): MockEnterpriseAddress {
    // Mock enterprise address creation
    const bytes = new Uint8Array(29);
    bytes[0] = networkId === 0 ? 0x60 : 0x70; // Address type
    return new MockEnterpriseAddress(new MockAddress(bytes));
  }
  
  to_address(): MockAddress {
    return this.address;
  }
}

class MockBaseAddress {
  constructor(private address: MockAddress) {}
  
  static new(networkId: number, paymentCred: MockCredential, stakeCred: MockCredential): MockBaseAddress {
    // Mock base address creation
    const bytes = new Uint8Array(57);
    bytes[0] = networkId === 0 ? 0x00 : 0x10; // Address type
    return new MockBaseAddress(new MockAddress(bytes));
  }
  
  to_address(): MockAddress {
    return this.address;
  }
}

class MockRewardAddress {
  constructor(private address: MockAddress) {}
  
  static new(networkId: number, credential: MockCredential): MockRewardAddress {
    // Mock reward address creation
    const bytes = new Uint8Array(29);
    bytes[0] = networkId === 0 ? 0xe0 : 0xf0; // Address type
    return new MockRewardAddress(new MockAddress(bytes));
  }
  
  to_address(): MockAddress {
    return this.address;
  }
}

// Mock ByronAddress class
class MockByronAddress {
  constructor(private bytes: Uint8Array) {}
  
  static from_base58(address: string): MockByronAddress {
    // Mock Byron address validation - check for Byron prefixes
    if (!address || !address.startsWith('Ddz') && !address.startsWith('Ae2')) {
      throw new Error('Invalid Byron address');
    }
    // AirGap compatible string encoding
    const bytes: number[] = [];
    for (let i = 0; i < address.length; i++) {
      bytes.push(address.charCodeAt(i) & 0xff);
    }
    return new MockByronAddress(new Uint8Array(bytes));
  }
}

// Mock AddressKind enum
export const AddressKind = {
  Base: 0,
  Ptr: 1,
  Enterprise: 2,
  Reward: 3,
  Byron: 4,
};

// Export all mocked classes
export {
  MockPublicKey as PublicKey,
  MockPrivateKey as PrivateKey,
  MockEd25519Signature as Ed25519Signature,
  MockEd25519KeyHash as Ed25519KeyHash,
  MockBip32PrivateKey as Bip32PrivateKey,
  MockBip32PublicKey as Bip32PublicKey,
  MockCredential as Credential,
  MockAddress as Address,
  MockEnterpriseAddress as EnterpriseAddress,
  MockBaseAddress as BaseAddress,
  MockRewardAddress as RewardAddress,
  MockByronAddress as ByronAddress,
};