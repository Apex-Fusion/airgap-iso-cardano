import { CardanoCrypto } from "../crypto/cardano-crypto";
import { create } from "../index";

describe("Cardano Cryptography", () => {
  describe("Basic Cryptographic Operations", () => {
    test("should generate a 24-word mnemonic", () => {
      const mnemonic = CardanoCrypto.generateMnemonic();

      expect(mnemonic).toHaveLength(24);
      expect(mnemonic.every((word: string) => typeof word === "string")).toBe(true);
    });

    test("should convert mnemonic to seed", async () => {
      // Use a valid 24-word BIP39 mnemonic for testing
      const mnemonic = CardanoCrypto.generateMnemonic();
      const seed = await CardanoCrypto.mnemonicToSeed(mnemonic);

      expect(seed instanceof Uint8Array).toBe(true);
      expect(seed.length).toBeGreaterThan(0);
    });

    test("should derive private key from mnemonic", async () => {
      // Use the CIP-3 test vector mnemonic for consistent testing
      const mnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      const rootKeypair = await CardanoCrypto.deriveRootKeypair(mnemonic);
      const childKeypair = await CardanoCrypto.deriveChildKeypair(rootKeypair, "m/1852'/1815'/0'/0/0");
      const privateKey = CardanoCrypto.getPrivateKey(childKeypair);

      // Private key should be valid
      expect(privateKey).toBeDefined();
      expect(privateKey instanceof Uint8Array).toBe(true);
      expect(privateKey.length).toBe(32);
    });

    test("should derive public key from keypair", async () => {
      const mnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      const rootKeypair = await CardanoCrypto.deriveRootKeypair(mnemonic);
      const childKeypair = await CardanoCrypto.deriveChildKeypair(rootKeypair, "m/1852'/1815'/0'/0/0");
      const publicKey = CardanoCrypto.getPublicKey(childKeypair);

      // Test that public key derivation works
      expect(publicKey).toBeDefined();
      expect(publicKey instanceof Uint8Array).toBe(true);
      expect(publicKey.length).toBe(32); // Public key is 32 bytes
    });

    test("should generate valid key pairs", async () => {
      const mnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      const keypair = await CardanoCrypto.derivePaymentKeypair(mnemonic, 0, 0);
      const privateKey = CardanoCrypto.getPrivateKey(keypair);
      const publicKey = CardanoCrypto.getPublicKey(keypair);
      
      // Test that keys are properly formatted
      expect(privateKey).toBeDefined();
      expect(privateKey.length).toBe(32);
      expect(publicKey).toBeDefined();
      expect(publicKey.length).toBe(32);
      
      // Note: Address generation requires protocol-level integration
      // This is tested in the integration section below
    });

    test("should handle key derivation paths correctly", async () => {
      const mnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];

      // Test different derivation paths
      const paths = [
        "m/1852'/1815'/0'/0/0",
        "m/1852'/1815'/0'/0/1", 
        "m/1852'/1815'/0'/1/0",
        "m/1852'/1815'/1'/0/0",
      ];

      const rootKeypair = await CardanoCrypto.deriveRootKeypair(mnemonic);
      const keypairs = await Promise.all(paths.map((path) =>
        CardanoCrypto.deriveChildKeypair(rootKeypair, path)
      ));

      // All keypairs should be defined and have correct length
      keypairs.forEach((keypair) => {
        expect(keypair).toBeDefined();
        expect(keypair.length).toBe(128); // Full keypair is 128 bytes
        
        const privateKey = CardanoCrypto.getPrivateKey(keypair);
        expect(privateKey.length).toBe(32);
      });

      // Keys should be consistently derived
      expect(keypairs.length).toBe(paths.length);
      
      // Test that different paths produce different results
      const firstKeypair = keypairs[0];
      const allSame = keypairs.every((keypair, i) => i === 0 || Buffer.from(keypair).equals(Buffer.from(firstKeypair)));
      expect(allSame).toBe(false); // Different paths should produce different keys
    });

    test("should handle invalid inputs gracefully", async () => {
      // Test invalid mnemonic
      await expect(
        CardanoCrypto.mnemonicToSeed(["invalid", "mnemonic"])
      ).rejects.toThrow();

      // Test that derivation functions handle valid inputs properly
      const validMnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      const result = await CardanoCrypto.derivePaymentKeypair(validMnemonic, 0, 0);
      expect(result).toBeDefined();
      expect(result.length).toBe(128);
    });
  });

  describe("CIP-3 Icarus Test Vectors", () => {
    it("should derive master key according to CIP-3 Icarus test vector (no passphrase)", async () => {
      // CIP-3 Icarus test vector from https://github.com/cardano-foundation/CIPs/blob/master/CIP-0003/Icarus.md
      const recoveryPhrase = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      // Expected master key from CIP-3 test vector
      const expectedMasterKey = "c065afd2832cd8b087c4d9ab7011f481ee1e0721e78ea5dd609f3ab3f156d245d176bd8fd4ec60b4731c3918a2a72a0226c0cd119ec35b47e4d55884667f552a23f7fdcd4a10c6cd2c7393ac61d877873e248f417634aa3d812af327ffe9d620";
      
      // Derive master keypair using our implementation
      const masterKeypair = await CardanoCrypto.deriveRootKeypair(recoveryPhrase, "");
      
      // Convert to hex string for comparison (first 96 bytes are the extended private key)
      const derivedMasterKey = Buffer.from(masterKeypair.slice(0, 96)).toString('hex');
      
      // Verify our implementation matches CIP-3 Icarus test vector
      expect(derivedMasterKey).toBe(expectedMasterKey);
    });

    it("should derive master key according to CIP-3 Icarus test vector (with passphrase)", async () => {
      // CIP-3 Icarus test vector with passphrase
      const recoveryPhrase = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      const passphrase = "foo";
      
      // Expected master key from CIP-3 test vector with passphrase
      const expectedMasterKey = "70531039904019351e1afb361cd1b312a4d0565d4ff9f8062d38acf4b15cce41d7b5738d9c893feea55512a3004acb0d222c35d3e3d5cde943a15a9824cbac59443cf67e589614076ba01e354b1a432e0e6db3b59e37fc56b5fb0222970a010e";
      
      // Derive master keypair using our implementation
      const masterKeypair = await CardanoCrypto.deriveRootKeypair(recoveryPhrase, passphrase);
      
      // Convert to hex string for comparison (first 96 bytes are the extended private key)
      const derivedMasterKey = Buffer.from(masterKeypair.slice(0, 96)).toString('hex');
      
      // Verify our implementation matches CIP-3 Icarus test vector
      expect(derivedMasterKey).toBe(expectedMasterKey);
    });

    it("should validate mnemonic according to BIP39 standard", () => {
      // CIP-3 test vector mnemonic
      const validMnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      // Invalid mnemonic
      const invalidMnemonic = ["invalid", "mnemonic", "words"];
      
      expect(CardanoCrypto.validateMnemonic(validMnemonic)).toBe(true);
      expect(CardanoCrypto.validateMnemonic(invalidMnemonic)).toBe(false);
    });
  });

  describe("CIP-1852 Compliance", () => {
    it("should use correct derivation paths for CIP-1852", async () => {
      const mnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      // Test payment keypair derivation (CIP-1852: m/1852'/1815'/account'/0/address_index)
      const paymentKeypair = await CardanoCrypto.derivePaymentKeypair(mnemonic, 0, 0);
      expect(paymentKeypair).toHaveLength(128); // 96 bytes extended private + 32 bytes public
      
      // Test stake keypair derivation (CIP-1852: m/1852'/1815'/account'/2/0)  
      const stakeKeypair = await CardanoCrypto.deriveStakeKeypair(mnemonic, 0);
      expect(stakeKeypair).toHaveLength(128);
      
      // Keypairs should be different
      expect(Buffer.from(paymentKeypair).equals(Buffer.from(stakeKeypair))).toBe(false);
    });

    it("should derive different keys for different account indices", async () => {
      const mnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      const account0Payment = await CardanoCrypto.derivePaymentKeypair(mnemonic, 0, 0);
      const account1Payment = await CardanoCrypto.derivePaymentKeypair(mnemonic, 1, 0);
      
      // Different accounts should produce different keys
      expect(Buffer.from(account0Payment).equals(Buffer.from(account1Payment))).toBe(false);
    });
  });

  describe("CIP-19 Compliance", () => {
    it("should generate correct Blake2b-224 hashes for payment keys", () => {
      // Test with known public key
      const testPublicKey = new Uint8Array(32);
      testPublicKey.fill(1); // Fill with 1s for deterministic test
      
      const paymentKeyHash = CardanoCrypto.createPaymentKeyHash(testPublicKey);
      
      // Blake2b-224 should produce 28-byte hash
      expect(paymentKeyHash).toHaveLength(28);
      
      // Hash should be deterministic
      const paymentKeyHash2 = CardanoCrypto.createPaymentKeyHash(testPublicKey);
      expect(Buffer.from(paymentKeyHash).equals(Buffer.from(paymentKeyHash2))).toBe(true);
    });

    it("should generate correct Blake2b-224 hashes for stake keys", () => {
      // Test with known stake key
      const testStakeKey = new Uint8Array(32);
      testStakeKey.fill(2); // Fill with 2s for deterministic test
      
      const stakeKeyHash = CardanoCrypto.createStakeKeyHash(testStakeKey);
      
      // Blake2b-224 should produce 28-byte hash
      expect(stakeKeyHash).toHaveLength(28);
      
      // Hash should be deterministic
      const stakeKeyHash2 = CardanoCrypto.createStakeKeyHash(testStakeKey);
      expect(Buffer.from(stakeKeyHash).equals(Buffer.from(stakeKeyHash2))).toBe(true);
    });
  });

  describe("Basic Cryptographic Properties", () => {
    it("should generate cryptographically secure random mnemonics", () => {
      const mnemonics = Array.from({ length: 10 }, () =>
        CardanoCrypto.generateMnemonic(),
      );

      // All mnemonics should be unique
      const uniqueMnemonics = new Set(mnemonics.map((m) => m.join(" ")));
      expect(uniqueMnemonics.size).toBe(mnemonics.length);

      // Each mnemonic should have proper entropy
      mnemonics.forEach((mnemonic) => {
        expect(mnemonic).toHaveLength(24);
        expect(mnemonic.every((word) => word.length > 0)).toBe(true);
      });
    });

    it("should use proper key derivation standards", async () => {
      const mnemonic = [
        "eight", "country", "switch", "draw", "meat", "scout", "mystery", "blade",
        "tip", "drift", "useless", "good", "keep", "usage", "title"
      ];
      
      // Test standard Cardano derivation paths
      const cardanoPaths = [
        "m/1852'/1815'/0'/0/0", // Standard receive address
        "m/1852'/1815'/0'/1/0", // Standard change address
        "m/1854'/1815'/0'/0/0", // Multi-sig receive
        "m/1854'/1815'/0'/1/0", // Multi-sig change
      ];

      const rootKeypair = await CardanoCrypto.deriveRootKeypair(mnemonic);
      
      for (const path of cardanoPaths) {
        const keypair = await CardanoCrypto.deriveChildKeypair(rootKeypair, path);
        const privateKey = CardanoCrypto.getPrivateKey(keypair);
        expect(privateKey).toBeDefined();
        expect(privateKey.length).toBe(32);
      }
    });
  });

  describe("24-Word Golden Test Vectors", () => {
    // Comprehensive 24-word BIP39 test vectors for AirGap Vault compatibility
    const CARDANO_24_WORD_TEST_VECTORS = [
      {
        "mnemonic": [
          "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", 
          "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", 
          "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", "abandon", "art"
        ],
        "description": "BIP39 Official 24-Word Test Vector",
        "rootKeys": {
          "privateKey": "b07ff3e63c17cd2e0504e4bfd52a98c47abde183ccd0738efc385e764fd91d4b",
          "publicKey": "51aa1dcac6324b41cb184e27589a208b7f1c941c620e1e0d10414c979989a7c2"
        },
        "derivedKeys": {
          "m/1852'/1815'/0'/0/0": {
            "type": "payment",
            "privateKey": "30ba2b88bffe5a25379c7ac72be48f5b196ff45a0758a83c6980a5e15fd91d4b",
            "publicKey": "63c5d69570349e4233a0575811464f0e8a3fd329abe76e9bdc3d3f1b95982179"
          },
          "m/1852'/1815'/0'/2/0": {
            "type": "stake",
            "privateKey": "28c89a4bfe3b7db51fe1d3bfc5f617b7656f19c1a77edc4936264d0a66d91d4b",
            "publicKey": "366598ec425ab8140830c4b5f91716d0f7b113fd7013ef3c90487e9dd1535437"
          }
        }
      },
      {
        "mnemonic": [
          "small", "outer", "prepare", "race", "neutral", "armed", "humble", "update", 
          "beyond", "glow", "post", "civil", "join", "horse", "convince", "tenant", 
          "bunker", "century", "hungry", "logic", "tunnel", "illness", "tool", "junk"
        ],
        "description": "Generated Valid 24-Word Test Vector #1",
        "rootKeys": {
          "privateKey": "a0b6d3173686c6d4d376aea22fd91a0b24d40705c424297ec836056fa0c21c4d",
          "publicKey": "62e138e501c32dbfe1b16a05e818179c988c8bc700ca9986821d5d87bcb689c9"
        },
        "derivedKeys": {
          "m/1852'/1815'/0'/0/0": {
            "type": "payment",
            "privateKey": "d09871f6c411d8afc2db907c34313073ce30faf8986b1315fc021416b2c21c4d",
            "publicKey": "7f4273ff434830c50a7c977fbfb819947327985877808864151660f43dfdfce5"
          },
          "m/1852'/1815'/0'/2/0": {
            "type": "stake",
            "privateKey": "68d53df8249350c7bbd078273833369aa7f546838df09f39e5a48edaaec21c4d",
            "publicKey": "6e2e31f29e6b1a99b78044d7654d5cb68227dd00f7a0f1d98f64306d36fa27d7"
          }
        }
      }
    ];

    it("should validate all 24-word test vector mnemonics", () => {
      CARDANO_24_WORD_TEST_VECTORS.forEach((vector) => {
        const isValid = CardanoCrypto.validateMnemonic(vector.mnemonic);
        expect(isValid).toBe(true);
      });
    });

    it("should derive correct root keys from 24-word mnemonics", async () => {
      for (const vector of CARDANO_24_WORD_TEST_VECTORS) {
        const rootKeypair = await CardanoCrypto.deriveRootKeypair(vector.mnemonic, "");
        const privateKey = CardanoCrypto.getPrivateKey(rootKeypair);
        const publicKey = CardanoCrypto.getPublicKey(rootKeypair);
        
        expect(Buffer.from(privateKey).toString('hex')).toBe(vector.rootKeys.privateKey);
        expect(Buffer.from(publicKey).toString('hex')).toBe(vector.rootKeys.publicKey);
      }
    });

    it("should derive correct payment keys from 24-word mnemonics", async () => {
      for (const vector of CARDANO_24_WORD_TEST_VECTORS) {
        const paymentKeypair = await CardanoCrypto.derivePaymentKeypair(vector.mnemonic, 0, 0);
        const privateKey = CardanoCrypto.getPrivateKey(paymentKeypair);
        const publicKey = CardanoCrypto.getPublicKey(paymentKeypair);
        
        const expectedPayment = vector.derivedKeys["m/1852'/1815'/0'/0/0"];
        expect(Buffer.from(privateKey).toString('hex')).toBe(expectedPayment.privateKey);
        expect(Buffer.from(publicKey).toString('hex')).toBe(expectedPayment.publicKey);
      }
    });

    it("should derive correct stake keys from 24-word mnemonics", async () => {
      for (const vector of CARDANO_24_WORD_TEST_VECTORS) {
        const stakeKeypair = await CardanoCrypto.deriveStakeKeypair(vector.mnemonic, 0);
        const privateKey = CardanoCrypto.getPrivateKey(stakeKeypair);
        const publicKey = CardanoCrypto.getPublicKey(stakeKeypair);
        
        const expectedStake = vector.derivedKeys["m/1852'/1815'/0'/2/0"];
        expect(Buffer.from(privateKey).toString('hex')).toBe(expectedStake.privateKey);
        expect(Buffer.from(publicKey).toString('hex')).toBe(expectedStake.publicKey);
      }
    });

    it("should generate different keys for different 24-word mnemonics", async () => {
      // Ensure different mnemonics produce different keys
      const keypairs = await Promise.all(
        CARDANO_24_WORD_TEST_VECTORS.map(vector => 
          CardanoCrypto.derivePaymentKeypair(vector.mnemonic, 0, 0)
        )
      );
      
      const publicKeys = keypairs.map(keypair => 
        Buffer.from(CardanoCrypto.getPublicKey(keypair)).toString('hex')
      );
      
      // All public keys should be unique
      const uniqueKeys = new Set(publicKeys);
      expect(uniqueKeys.size).toBe(CARDANO_24_WORD_TEST_VECTORS.length);
    });

    it("should generate consistent key hashes for 24-word mnemonics", async () => {
      for (const vector of CARDANO_24_WORD_TEST_VECTORS) {
        const paymentKeypair = await CardanoCrypto.derivePaymentKeypair(vector.mnemonic, 0, 0);
        const stakeKeypair = await CardanoCrypto.deriveStakeKeypair(vector.mnemonic, 0);
        
        const paymentPublicKey = CardanoCrypto.getPublicKey(paymentKeypair);
        const stakePublicKey = CardanoCrypto.getPublicKey(stakeKeypair);
        
        // Generate key hashes
        const paymentKeyHash = CardanoCrypto.createPaymentKeyHash(paymentPublicKey);
        const stakeKeyHash = CardanoCrypto.createStakeKeyHash(stakePublicKey);
        
        // Hashes should be deterministic (28 bytes for Blake2b-224)
        expect(paymentKeyHash).toHaveLength(28);
        expect(stakeKeyHash).toHaveLength(28);
        
        // Re-derive and ensure consistency
        const paymentKeyHash2 = CardanoCrypto.createPaymentKeyHash(paymentPublicKey);
        const stakeKeyHash2 = CardanoCrypto.createStakeKeyHash(stakePublicKey);
        
        expect(Buffer.from(paymentKeyHash).equals(Buffer.from(paymentKeyHash2))).toBe(true);
        expect(Buffer.from(stakeKeyHash).equals(Buffer.from(stakeKeyHash2))).toBe(true);
      }
    });
  });
});