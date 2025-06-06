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
      expect(metadata.identifier).toBe("cardano");
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
      expect(typeof protocol.getCurrentEpoch).toBe("function");
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

  describe("Analytics Extensions", () => {
    it("should have analytics functionality", async () => {
      expect(typeof protocol.getDetailedTransaction).toBe("function");
      expect(typeof protocol.getTransactionStats).toBe("function");
      expect(typeof protocol.getDeFiActivity).toBe("function");
      expect(typeof protocol.getPortfolioMetrics).toBe("function");
      expect(typeof protocol.getTransactionFlow).toBe("function");
    });

    it("should get detailed transaction info", async () => {
      const txHash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      const tx = await protocol.getDetailedTransaction(txHash, keyPair.publicKey);
      
      // Transaction may be null if not found, which is acceptable for a test hash
      if (tx) {
        expect(typeof tx.txHash).toBe("string");
        expect(typeof tx.blockHeight).toBe("number");
      }
    }, 10000);

    it("should get transaction flow analysis", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      const flow = await protocol.getTransactionFlow(keyPair.publicKey, 'week');
      
      expect(typeof flow).toBe("object");
      expect(Array.isArray(flow.inflow)).toBe(true);
      expect(Array.isArray(flow.outflow)).toBe(true);
      expect(Array.isArray(flow.netFlow)).toBe(true);
    });
  });

  describe("Governance Extensions", () => {
    it("should have governance functionality", async () => {
      expect(typeof protocol.getGovernanceProposals).toBe("function");
      expect(typeof protocol.getVotingPower).toBe("function");
      expect(typeof protocol.createGovernanceVote).toBe("function");
      expect(typeof protocol.getVotingHistory).toBe("function");
      expect(typeof protocol.getCatalystProposals).toBe("function");
      expect(typeof protocol.registerForCatalystVoting).toBe("function");
      expect(typeof protocol.createMultiSigScript).toBe("function");
      expect(typeof protocol.createMultiSigWallet).toBe("function");
      expect(typeof protocol.createMultiSigTransaction).toBe("function");
      expect(typeof protocol.signMultiSigTransaction).toBe("function");
      expect(typeof protocol.getMultiSigWallet).toBe("function");
    });

    it("should create multi-sig scripts", () => {
      const publicKeys = [
        "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234"
      ];
      const requiredSignatures = 2;
      
      const script = protocol.createMultiSigScript(publicKeys, requiredSignatures);
      
      expect(script.type).toBe("atLeast");
      expect(script.required).toBe(2);
      expect(script.scripts).toHaveLength(3);
      expect(script.scripts?.[0].type).toBe("sig");
    });

    it("should get governance proposals", async () => {
      const proposals = await protocol.getGovernanceProposals();
      expect(Array.isArray(proposals)).toBe(true);
      // Note: Will be empty until CIP-1694 is implemented
    });

    it("should get catalyst proposals", async () => {
      const proposals = await protocol.getCatalystProposals();
      expect(Array.isArray(proposals)).toBe(true);
    });
  });

  describe("Enhanced Functionality", () => {
    it("should get comprehensive account summary", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      const summary = await protocol.getAccountSummary(keyPair.publicKey);
      
      expect(typeof summary).toBe("object");
      expect(summary.lastUpdated).toBeInstanceOf(Date);
      // Individual components may be null if services are unavailable
    });

    it("should get service status", async () => {
      const status = await protocol.getServiceStatus();
      
      expect(typeof status).toBe("object");
      expect(typeof status.networkConnectivity).toBe("boolean");
      expect(typeof status.dataProviders).toBe("object");
      expect(status.timestamp).toBeInstanceOf(Date);
    });

    it("should check online service availability", async () => {
      const isAvailable = await protocol.isOnlineServiceAvailable();
      expect(typeof isAvailable).toBe("boolean");
    });
  });

  describe("Integration Tests", () => {
    it("should work with offline protocol methods", async () => {
      const keyPair = await protocol.generateKeyPair(testMnemonic);
      const address = await protocol.getAddressFromPublicKey(keyPair.publicKey);
      
      // Test that enhanced protocol still supports all base protocol methods
      expect(address).toMatch(/^addr1[a-z0-9]+/);
      
      const metadata = await protocol.getMetadata();
      expect(metadata.identifier).toBe("cardano");
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