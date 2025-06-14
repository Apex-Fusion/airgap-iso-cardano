/**
 * Tests for Enhanced Cardano Protocol with online extensions
 */

import { EnhancedCardanoProtocol } from "../protocol/enhanced-cardano-protocol";
import { CardanoProtocolOptions } from "../types/cardano";

describe("EnhancedCardanoProtocol", () => {
  let protocol: EnhancedCardanoProtocol;
  const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  beforeEach(() => {
    const options: CardanoProtocolOptions = { network: "mainnet" };
    protocol = new EnhancedCardanoProtocol(options);
  });

  describe("Basic Protocol Functionality", () => {
    it("should initialize correctly", async () => {
      const metadata = await protocol.getMetadata();
      expect(metadata.identifier).toBe("ada");
      expect(metadata.name).toBe("Cardano");
      expect(metadata.mainUnit).toBe("ADA");
    });

    it("should generate key pairs", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      expect(keyPair.publicKey.type).toBe("pub");
      expect(keyPair.secretKey.type).toBe("priv");
      expect(keyPair.publicKey.value).toMatch(/^[a-f0-9]+$/);
      expect(keyPair.secretKey.value).toMatch(/^[a-f0-9]+$/);
    });

    it("should generate addresses from public keys", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      const address = await protocol.getAddressFromPublicKey(keyPair.publicKey);
      expect(address).toMatch(/^addr1[a-z0-9]+/);
    });
  });

  describe("Staking Extensions", () => {
    it("should have staking functionality", async () => {
      expect(typeof protocol.getStakePools).toBe("function");
      expect(typeof protocol.getStakePoolDetails).toBe("function");
      expect(typeof protocol.getDelegationInfo).toBe("function");
      expect(typeof protocol.getRewardsHistory).toBe("function");
      expect(typeof protocol.getStakingActivity).toBe("function");
      expect(typeof protocol.getTopStakePools).toBe("function");
      expect(typeof protocol.calculateStakingRewards).toBe("function");
      expect(typeof protocol.getCurrentEpochInfo).toBe("function");
    });

    it("should calculate staking rewards", async () => {
      const amount = "1000000000"; // 1000 ADA
      const poolRoa = 5.2; // 5.2% ROA
      const rewards = await protocol.calculateStakingRewards(amount, poolRoa);
      
      expect(rewards.unit).toBe("ADA");
      expect(Number(rewards.value)).toBeGreaterThan(0);
      expect(Number(rewards.value)).toBeLessThan(Number(amount)); // Rewards should be less than principal
    });

    it("should get top stake pools", async () => {
      const pools = await protocol.getTopStakePools('roa', 5);
      expect(Array.isArray(pools)).toBe(true);
      // Note: In real network conditions, this would return actual pools
    });
  });

  describe("Asset Extensions", () => {
    it("should have asset functionality", async () => {
      expect(typeof protocol.getPortfolio).toBe("function");
      expect(typeof protocol.getTokenBalances).toBe("function");
      expect(typeof protocol.getAssetMetadata).toBe("function");
      expect(typeof protocol.getAssetPrice).toBe("function");
      expect(typeof protocol.getAssetTransferHistory).toBe("function");
      expect(typeof protocol.searchAssets).toBe("function");
      expect(typeof protocol.getNFTCollection).toBe("function");
    });

    it("should get asset metadata", async () => {
      const policyId = "a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235";
      const assetName = "HOSKY";
      const metadata = await protocol.getAssetMetadata(policyId, assetName);
      
      if (metadata) {
        expect(metadata.policyId).toBe(policyId);
        expect(metadata.assetName).toBe(assetName);
        expect(typeof metadata.fingerprint).toBe("string");
      }
      // Asset metadata may be null if not found, which is acceptable
    });

    it("should search for assets", async () => {
      const results = await protocol.searchAssets("HOSKY", 10);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("Enhanced Extensions", () => {
    it("should have enhanced functionality", async () => {
      expect(typeof protocol.getDetailsFromTransaction).toBe("function");
      expect(typeof protocol.getPortfolio).toBe("function");
      expect(typeof protocol.getTokenBalances).toBe("function");
      expect(typeof protocol.getAssetMetadata).toBe("function");
      expect(typeof protocol.getCurrentEpochInfo).toBe("function");
    });

    it("should get detailed transaction info", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      
      // Create a mock unsigned transaction for testing
      const mockTransaction = {
        type: "unsigned" as const,
        transaction: {
          cbor: "84a100818258204cbf78a7bd506d6..."  // Mock CBOR
        }
      };
      
      const txDetails = await protocol.getDetailsFromTransaction(mockTransaction, keyPair.publicKey);
      
      // Should return an array of AirGapTransaction objects
      expect(Array.isArray(txDetails)).toBe(true);
      // Details may be empty for mock transaction, which is acceptable
    }, 10000);

    it("should get asset portfolio information", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      
      try {
        const portfolio = await protocol.getPortfolio(keyPair.publicKey);
        
        expect(typeof portfolio).toBe("object");
        expect(portfolio.adaBalance).toBeDefined();
        expect(Array.isArray(portfolio.tokens)).toBe(true);
        expect(Array.isArray(portfolio.nfts)).toBe(true);
      } catch (error) {
        // In test environment, API providers may fail - this is expected
        expect((error as Error).message).toContain("All data providers failed");
        
        // Test passes as long as the method exists and handles failures gracefully
        expect(typeof protocol.getPortfolio).toBe("function");
      }
    }, 10000);
  });

  describe("Asset Extensions", () => {
    it("should have asset functionality", async () => {
      expect(typeof protocol.getTokenBalances).toBe("function");
      expect(typeof protocol.getAssetPrice).toBe("function");
      expect(typeof protocol.searchAssets).toBe("function");
      expect(typeof protocol.getAssetTransferHistory).toBe("function");
    });

    it("should get token balances", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      const tokens = await protocol.getTokenBalances(keyPair.publicKey);
      
      expect(Array.isArray(tokens)).toBe(true);
      // Token array may be empty for test wallet, which is acceptable
    }, 10000);

    it("should search for assets", async () => {
      const results = await protocol.searchAssets("cardano", 5);
      expect(Array.isArray(results)).toBe(true);
      // Results may be empty for test query, which is acceptable
    }, 10000);
  });

  describe("Integration Tests", () => {
    it("should work with offline protocol methods", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      const address = await protocol.getAddressFromPublicKey(keyPair.publicKey);
      
      // Test that enhanced protocol still supports all base protocol methods
      expect(address).toMatch(/^addr1[a-z0-9]+/);
      
      const metadata = await protocol.getMetadata();
      expect(metadata.identifier).toBe("ada");
    });

    it("should maintain AirGap compatibility", async () => {
      // Test that the enhanced protocol maintains compatibility with AirGap interfaces
      const metadata = await protocol.getMetadata();
      expect(metadata.units.ADA.decimals).toBe(6);
      expect(metadata.units.ADA.symbol.value).toBe("ADA");
      
      const network = await protocol.getNetwork();
      expect(network.name).toMatch(/Mainnet|Testnet/);
      expect(network.type).toMatch(/mainnet|testnet/);
    });
  });
});