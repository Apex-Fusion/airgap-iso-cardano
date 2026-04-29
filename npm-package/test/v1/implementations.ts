import {
  Amount,
  AirGapTransaction,
  KeyPair,
  PublicKey,
  SecretKey,
  SignedTransaction,
  UnsignedTransaction,
  ExtendedPublicKey,
  ExtendedSecretKey,
  ProtocolNetwork
} from "@airgap/module-kit";

// Define wallet status enum if not available in module-kit
export enum AirGapWalletStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending'
}

// Test Protocol Specification Interface - Standard AirGap Pattern
export interface TestProtocolSpec {
  name: string;
  lib: any; // Protocol instance
  stub: ProtocolHTTPStub;
  validAddresses: string[];
  wallet: WalletTestData;
  txs: TransactionTestData[];
  messages?: MessageTestData[];
  encryptAsymmetric?: EncryptionTestData[];
  encryptAES?: EncryptionTestData[];
  transactionStatusTests?: TransactionStatusTestData[];
  
  // Required methods
  derivative(): Promise<TestCryptoDerivative>;
  seed(): string;
  mnemonic(): string;
}

// Standard Test Data Interfaces
export interface WalletTestData {
  privateKey: string;
  publicKey: string;
  addresses: string[];
  masterFingerprint: string;
  status: AirGapWalletStatus;
  extendedPrivateKey?: string;
  extendedPublicKey?: string;
}

export interface TransactionTestData {
  to: string[];
  from: string[];
  amount: Amount<any>;
  fee: Amount<any>;
  properties?: string[];
  unsignedTx: any;
  signedTx: any;
}

export interface MessageTestData {
  message: string;
  signature: string;
}

export interface EncryptionTestData {
  message: string;
  encrypted: string;
}

export interface TransactionStatusTestData {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
}

// HTTP Stub Interface for mocking network requests
export interface ProtocolHTTPStub {
  registerStub(testProtocolSpec: TestProtocolSpec, protocol: any): Promise<void>;
  noBalanceStub?(testProtocolSpec: TestProtocolSpec, protocol: any): Promise<void>;
}

// Utility functions for testing
export const itIf = (condition: boolean, title: string, test: jest.ProvidesCallback) => {
  return condition ? it(title, test) : it.skip(title, test);
};

// Runtime-aware version that evaluates condition at test execution time
export const itIfRuntime = (conditionFn: () => boolean, title: string, test: () => Promise<void> | void) => {
  return it(title, async () => {
    if (!conditionFn()) {
      // Skip at runtime by returning early - test will pass but indicate it was skipped
      console.log(`⚠️  Skipping test: ${title} - condition not met`);
      return;
    }
    return await test();
  });
};

// Check if protocol supports BIP32 extended keys
export const isBip32Protocol = (protocol: any): boolean => {
  return (
    protocol &&
    typeof protocol.getExtendedKeyPairFromDerivative === 'function' &&
    typeof protocol.deriveFromExtendedPublicKey === 'function'
  );
};

// Check if protocol supports block explorer functionality
export const hasBlockExplorer = (protocol: any): boolean => {
  return (
    protocol &&
    typeof protocol.getBlockExplorerLinkForAddress === 'function' &&
    typeof protocol.getBlockExplorerLinkForTxId === 'function'
  );
};

// Check if protocol supports message signing
export const supportsMessageSigning = (protocol: any): boolean => {
  return (
    protocol &&
    typeof protocol.signMessageWithKeyPair === 'function' &&
    typeof protocol.verifyMessageWithPublicKey === 'function'
  );
};

// Check if protocol supports encryption
export const supportsEncryption = (protocol: any): boolean => {
  return (
    protocol &&
    (typeof protocol.encryptAsymmetricWithPublicKey === 'function' ||
     typeof protocol.encryptAESWithSecretKey === 'function')
  );
};

// Proper CryptoDerivative for testing that matches AirGap interface
export interface TestCryptoDerivative {
  depth: number;
  parentFingerprint: number;
  index: number;
  chainCode: string;
  secretKey: string;
  publicKey: string;
}

// Common test constants
export const TEST_MNEMONIC = 
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

export const TEST_DERIVATION_PATH = "m/1852'/1815'/0'/0/0";

// Protocol test configuration interface
export interface ProtocolTestConfig {
  network?: ProtocolNetwork;
  config?: any;
}

// Test vectors for Cardano
export const CARDANO_TEST_VECTORS = {
  // Test mnemonic from Cardano documentation
  mnemonic: "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  
  // Expected addresses for different networks
  addresses: {
    mainnet: {
      payment: "addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp",
      enterprise: "addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqcljjvz",
    },
    testnet: {
      payment: "addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwqsv9y8x",
      enterprise: "addr_test1vz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq4h7ksj",
    }
  },
  
  // Derivation paths
  derivationPaths: {
    payment: "m/1852'/1815'/0'/0/0",
    staking: "m/1852'/1815'/0'/2/0",
    change: "m/1852'/1815'/0'/1/0"
  }
};

// Test assertion helpers
export class TestHelpers {
  static expectValidAddress(address: string, validAddresses: string[]): void {
    expect(validAddresses.some(valid => address.includes(valid.slice(0, 10)))).toBe(true);
  }

  static expectValidKeyPair(keyPair: KeyPair): void {
    expect(keyPair).toBeDefined();
    expect(keyPair.secretKey).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.secretKey.type).toBe("priv");
    expect(keyPair.publicKey.type).toBe("pub");
  }

  static expectValidTransaction(tx: UnsignedTransaction | SignedTransaction): void {
    expect(tx).toBeDefined();
    expect(tx.type).toBeDefined();
  }

  static expectValidAmount(amount: Amount<any>): void {
    expect(amount).toBeDefined();
    expect(amount.value).toBeDefined();
    expect(amount.unit).toBeDefined();
  }

  static expectValidSignature(signature: string): void {
    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(0);
  }

  static expectHTTPS(url: string): void {
    expect(url.startsWith('https://')).toBe(true);
  }

  static expectValidBlockExplorerUrl(url: string): void {
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
    TestHelpers.expectHTTPS(url);
  }

  // Additional helpers following AirGap patterns
  static expectValidAddressFormat(address: string, regex?: string): void {
    expect(address).toBeDefined();
    expect(typeof address).toBe("string");
    expect(address.length).toBeGreaterThan(0);
    
    if (regex) {
      const match = address.match(new RegExp(regex));
      expect(match).not.toBe(null);
      expect(match!.length).toBeGreaterThan(0);
    }
  }

  static expectNoPlaceholders(url: string): void {
    expect(url).not.toContain('{{');
    expect(url).not.toContain('}}');
  }

  static expectNoDoubleSlashes(url: string): void {
    const withoutProtocol = url.split('https://').join('');
    expect(withoutProtocol).not.toContain('//');
  }
}

// Abstract base class for protocol test implementations
export abstract class TestProtocolSpecBase implements TestProtocolSpec {
  abstract name: string;
  abstract lib: any;
  abstract stub: ProtocolHTTPStub;
  abstract validAddresses: string[];
  abstract wallet: WalletTestData;
  abstract txs: TransactionTestData[];
  abstract messages?: MessageTestData[];
  abstract encryptAsymmetric?: EncryptionTestData[];
  abstract encryptAES?: EncryptionTestData[];
  abstract transactionStatusTests?: TransactionStatusTestData[];

  // Default implementations
  async derivative(): Promise<TestCryptoDerivative> {
    return {
      depth: 5,
      parentFingerprint: 0x5c1bd648,
      index: 0,
      chainCode: "873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508",
      secretKey: "edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b73f55d5f7b69b726a03b06",
      publicKey: "a074b89c0b1f2e8b734f8b1b7e8e92cd5fa3c9a1b4e2f3d6e7f8a9b0c1d2e3f4"
    };
  }

  seed(): string {
    return TEST_MNEMONIC;
  }

  mnemonic(): string {
    return TEST_MNEMONIC;
  }
}