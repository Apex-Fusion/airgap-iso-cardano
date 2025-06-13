import { UTXOSelector, UTXO, UTXOSelectionResult } from "../transaction/utxo-selector";
import { UTXOSelectionError, ValidationError } from "../errors/error-types";

describe("TyphonJS-Optimized UTXO Selector", () => {
  let selector: UTXOSelector;

  beforeEach(() => {
    selector = new UTXOSelector();
  });

  const createMockUTXO = (amount: number, txHash?: string): UTXO => ({
    txHash: txHash || `mock-tx-${Math.random().toString(36).substring(7)}`,
    outputIndex: 0,
    amount: BigInt(amount),
    address: "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj",
  });

  const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

  describe("Basic UTXO Selection", () => {
    test("should select UTXOs successfully", async () => {
      const utxos = [
        createMockUTXO(5000000), // 5 ADA
        createMockUTXO(3000000), // 3 ADA
        createMockUTXO(2000000), // 2 ADA
      ];
      const target = BigInt(4000000); // 4 ADA

      const result = await selector.selectUtxos(utxos, target, changeAddress);

      expect(result).toBeDefined();
      expect(result.selectedUtxos.length).toBeGreaterThan(0);
      expect(result.totalAmount).toBeGreaterThanOrEqual(target);
      expect(result.changeAmount).toBe(result.totalAmount - target);
      expect(result.selectionStrategy).toBe("typhonjs-optimized");
    });

    test("should throw error for insufficient funds", async () => {
      const utxos = [createMockUTXO(1000000)]; // 1 ADA
      const target = BigInt(5000000); // 5 ADA

      await expect(
        selector.selectUtxos(utxos, target, changeAddress)
      ).rejects.toThrow(UTXOSelectionError);
    });

    test("should use largest-first selection strategy", async () => {
      const utxos = [
        createMockUTXO(10000000), // 10 ADA
        createMockUTXO(5000000),  // 5 ADA
        createMockUTXO(3000000),  // 3 ADA
      ];
      const target = BigInt(6000000); // 6 ADA

      const result = await selector.selectUtxos(utxos, target, changeAddress);

      // Should select the 10 ADA UTXO (largest first)
      expect(result.selectedUtxos.length).toBe(1);
      expect(result.selectedUtxos[0].amount).toBe(BigInt(10000000));
      expect(result.changeAmount).toBe(BigInt(4000000)); // 10 - 6 = 4 ADA change
    });

    test("should handle multiple UTXO selection when needed", async () => {
      const utxos = [
        createMockUTXO(3000000), // 3 ADA
        createMockUTXO(3000000), // 3 ADA
        createMockUTXO(2000000), // 2 ADA
      ];
      const target = BigInt(5000000); // 5 ADA

      const result = await selector.selectUtxos(utxos, target, changeAddress);

      expect(result.selectedUtxos.length).toBeGreaterThan(1);
      expect(result.totalAmount).toBeGreaterThanOrEqual(target);
    });
  });

  describe("Input Validation", () => {
    test("should validate empty UTXO set", async () => {
      const utxos: UTXO[] = [];
      const target = BigInt(1000000);

      await expect(
        selector.selectUtxos(utxos, target, changeAddress)
      ).rejects.toThrow(UTXOSelectionError);
    });

    test("should validate negative amount", async () => {
      const utxos = [createMockUTXO(5000000)];

      await expect(
        selector.selectUtxos(utxos, BigInt(-1), changeAddress)
      ).rejects.toThrow(UTXOSelectionError);
    });

    test("should validate zero amount", async () => {
      const utxos = [createMockUTXO(5000000)];

      await expect(
        selector.selectUtxos(utxos, BigInt(0), changeAddress)
      ).rejects.toThrow(UTXOSelectionError);
    });

    test("should validate change address", async () => {
      const utxos = [createMockUTXO(5000000)];
      const target = BigInt(1000000);

      await expect(
        selector.selectUtxos(utxos, target, "invalid-address")
      ).rejects.toThrow(UTXOSelectionError);
    });

    test("should validate empty change address", async () => {
      const utxos = [createMockUTXO(5000000)];
      const target = BigInt(1000000);

      await expect(
        selector.selectUtxos(utxos, target, "")
      ).rejects.toThrow(UTXOSelectionError);
    });
  });

  describe("Asset-Aware Selection", () => {
    test("should select UTXOs with required assets", async () => {
      const utxos = [
        {
          ...createMockUTXO(5000000),
          assets: new Map([["asset1", BigInt(1000000)]])
        },
        createMockUTXO(3000000), // No assets
        {
          ...createMockUTXO(2000000),
          assets: new Map([["asset2", BigInt(500000)]])
        }
      ];
      const requiredAda = BigInt(1000000);
      const requiredAssets = new Map([["asset1", BigInt(500000)]]);

      const result = await selector.selectUtxosWithAssets(
        utxos, 
        requiredAda, 
        requiredAssets, 
        changeAddress
      );

      expect(result).toBeDefined();
      expect(result.selectionStrategy).toBe("typhonjs-asset-aware");
      expect(result.totalAmount).toBeGreaterThanOrEqual(requiredAda);
      
      // Should include the UTXO with asset1
      const hasRequiredAsset = result.selectedUtxos.some(utxo => 
        utxo.assets && utxo.assets.has("asset1")
      );
      expect(hasRequiredAsset).toBe(true);
    });

    test("should throw error for missing required assets", async () => {
      const utxos = [
        createMockUTXO(5000000), // No assets
        {
          ...createMockUTXO(3000000),
          assets: new Map([["asset2", BigInt(500000)]]) // Wrong asset
        }
      ];
      const requiredAda = BigInt(1000000);
      const requiredAssets = new Map([["asset1", BigInt(500000)]]);

      await expect(
        selector.selectUtxosWithAssets(utxos, requiredAda, requiredAssets, changeAddress)
      ).rejects.toThrow(UTXOSelectionError);
    });

    test("should handle multiple required assets", async () => {
      const utxos = [
        {
          ...createMockUTXO(5000000),
          assets: new Map([
            ["asset1", BigInt(1000000)],
            ["asset2", BigInt(500000)]
          ])
        },
        {
          ...createMockUTXO(3000000),
          assets: new Map([["asset3", BigInt(750000)]])
        }
      ];
      const requiredAda = BigInt(2000000);
      const requiredAssets = new Map([
        ["asset1", BigInt(500000)],
        ["asset2", BigInt(250000)]
      ]);

      const result = await selector.selectUtxosWithAssets(
        utxos, 
        requiredAda, 
        requiredAssets, 
        changeAddress
      );

      expect(result).toBeDefined();
      expect(result.totalAmount).toBeGreaterThanOrEqual(requiredAda);
    });
  });

  describe("Edge Cases", () => {
    test("should handle exact amount match", async () => {
      const utxos = [createMockUTXO(5000000)]; // Exactly 5 ADA
      const target = BigInt(5000000); // Need exactly 5 ADA

      const result = await selector.selectUtxos(utxos, target, changeAddress);

      expect(result.selectedUtxos.length).toBe(1);
      expect(result.totalAmount).toBe(target);
      expect(result.changeAmount).toBe(BigInt(0));
    });

    test("should handle large amounts", async () => {
      const largeAmount = 50000000000; // 50,000 ADA (reasonable large amount)
      const utxos = [createMockUTXO(largeAmount)];
      const target = BigInt(10000000000); // 10,000 ADA

      const result = await selector.selectUtxos(utxos, target, changeAddress);

      expect(result).toBeDefined();
      expect(result.totalAmount).toBeGreaterThanOrEqual(target);
    });

    test("should limit input count to maximum", async () => {
      // Create 25 small UTXOs (more than MAX_INPUTS = 20)
      const utxos = Array.from({ length: 25 }, () => createMockUTXO(500000)); // 0.5 ADA each (higher to ensure sufficient funds)
      const target = BigInt(1500000); // 1.5 ADA (requires only 3 UTXOs)

      const result = await selector.selectUtxos(utxos, target, changeAddress);

      expect(result.selectedUtxos.length).toBeLessThanOrEqual(20); // Should respect MAX_INPUTS
      expect(result.totalAmount).toBeGreaterThanOrEqual(target);
    });
  });
});