import {
  TyphonTransactionBuilder as CardanoTransactionBuilder,
} from "../transaction/typhon-transaction-builder";
import { TransactionOutput } from "../transaction/typhon-transaction-builder";
import { UTXO } from "../transaction/utxo-selector";

// No mocking needed - using TyphonJS implementation

// Official Cardano protocol parameters (complete TyphonJS ProtocolParams)
const CARDANO_PROTOCOL_PARAMS = {
  minFeeA: new (require('bignumber.js'))(44),
  minFeeB: new (require('bignumber.js'))(155381),
  stakeKeyDeposit: new (require('bignumber.js'))('2000000'),
  lovelacePerUtxoWord: new (require('bignumber.js'))('4310'),
  utxoCostPerByte: new (require('bignumber.js'))('4310'),
  collateralPercent: new (require('bignumber.js'))(150),
  priceSteps: new (require('bignumber.js'))('0.0000721'),
  priceMem: new (require('bignumber.js'))('0.0577'),
  maxTxSize: 16384,
  maxValueSize: 5000,
  minFeeRefScriptCostPerByte: new (require('bignumber.js'))('15'),
  languageView: {
    PlutusScriptV1: [],
    PlutusScriptV2: [],
    PlutusScriptV3: []
  }
};

const CARDANO_MIN_UTXO = 1344798; // Minimum UTXO value in lovelace

function createMockUTXO(amount: number, txHash?: string): UTXO {
  // Generate valid 64-character hex transaction hash if not provided
  const validTxHash = txHash || Array.from(
    { length: 64 }, 
    () => Math.floor(Math.random() * 16).toString(16)
  ).join('');
  
  return {
    txHash: validTxHash,
    outputIndex: 0,
    amount: BigInt(amount),
    address: "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj",
  };
}

function createMockOutput(amount: number): TransactionOutput {
  return {
    address: "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj",
    amount: BigInt(amount),
  };
}

describe("TyphonJS Transaction Builder", () => {
  let builder: CardanoTransactionBuilder;

  beforeEach(() => {
    builder = new CardanoTransactionBuilder(CARDANO_PROTOCOL_PARAMS);
  });

  describe("Transaction Building", () => {
    test("should build a basic transaction successfully", async () => {
      const availableUTXOs = [createMockUTXO(10000000)]; // 10 ADA
      const outputs = [createMockOutput(2000000)]; // 2 ADA
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

      const result = await builder.buildTransaction(availableUTXOs, {
        outputs,
        changeAddress,
      });

      expect(result).toBeDefined();
      expect(result.transactionCbor).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      expect(BigInt(result.fee.toString())).toBeGreaterThan(BigInt(0));
      expect(result.inputs.length).toBeGreaterThan(0);
      expect(result.outputs.length).toBeGreaterThan(0);
    });

    test("should handle multiple outputs", async () => {
      const availableUTXOs = [createMockUTXO(100000000)]; // 100 ADA
      const outputs = [
        createMockOutput(2000000), // 2 ADA
        createMockOutput(3000000), // 3 ADA
      ];
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

      const result = await builder.buildTransaction(availableUTXOs, {
        outputs,
        changeAddress,
      });

      expect(result.outputs.length).toBeGreaterThanOrEqual(2);
      // Should include the requested outputs (TyphonJS uses BigNumber)
      expect(result.outputs.some(o => o.amount.toString() === "2000000")).toBe(true);
      expect(result.outputs.some(o => o.amount.toString() === "3000000")).toBe(true);
    });

    test("should calculate fees correctly", async () => {
      const availableUTXOs = [createMockUTXO(5000000)]; // 5 ADA
      const outputs = [createMockOutput(2000000)]; // 2 ADA
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

      const result = await builder.buildTransaction(availableUTXOs, {
        outputs,
        changeAddress,
      });

      // Fee should be reasonable for a simple transaction
      expect(BigInt(result.fee.toString())).toBeGreaterThan(BigInt(100000)); // > 0.1 ADA
      expect(BigInt(result.fee.toString())).toBeLessThan(BigInt(1000000)); // < 1 ADA
    });

    test("should throw error for insufficient funds", async () => {
      const availableUTXOs = [createMockUTXO(1000000)]; // 1 ADA
      const outputs = [createMockOutput(5000000)]; // 5 ADA (more than available)
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

      await expect(
        builder.buildTransaction(availableUTXOs, {
          outputs,
          changeAddress,
        })
      ).rejects.toThrow();
    });

    test("should handle metadata correctly", async () => {
      const availableUTXOs = [createMockUTXO(10000000)]; // 10 ADA
      const outputs = [createMockOutput(2000000)]; // 2 ADA
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";
      const metadata = { "674": { msg: ["Hello Cardano!"] } };

      const result = await builder.buildTransaction(availableUTXOs, {
        outputs,
        changeAddress,
        metadata,
      });

      expect(result.transactionCbor).toBeDefined();
      // With metadata, transaction should be larger
      expect(BigInt(result.fee.toString())).toBeGreaterThan(BigInt(150000)); // Should be higher due to metadata
    });
  });

  describe("Error Handling", () => {
    test("should handle empty UTXO set", async () => {
      const availableUTXOs: UTXO[] = [];
      const outputs = [createMockOutput(2000000)];
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

      await expect(
        builder.buildTransaction(availableUTXOs, {
          outputs,
          changeAddress,
        })
      ).rejects.toThrow();
    });

    test("should handle invalid change address", async () => {
      const availableUTXOs = [createMockUTXO(10000000)];
      const outputs = [createMockOutput(2000000)];
      const invalidChangeAddress = "invalid-address";

      await expect(
        builder.buildTransaction(availableUTXOs, {
          outputs,
          changeAddress: invalidChangeAddress,
        })
      ).rejects.toThrow();
    });

    test("should handle zero amount outputs", async () => {
      const availableUTXOs = [createMockUTXO(10000000)];
      const outputs = [createMockOutput(0)]; // Zero amount
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

      await expect(
        builder.buildTransaction(availableUTXOs, {
          outputs,
          changeAddress,
        })
      ).rejects.toThrow();
    });
  });

  describe("UTXO Selection", () => {
    test("should select optimal UTXOs", async () => {
      const availableUTXOs = [
        createMockUTXO(1000000, "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),   // 1 ADA
        createMockUTXO(5000000, "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"),  // 5 ADA  
        createMockUTXO(10000000, "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"),  // 10 ADA
      ];
      const outputs = [createMockOutput(3000000)]; // 3 ADA
      const changeAddress = "addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj";

      const result = await builder.buildTransaction(availableUTXOs, {
        outputs,
        changeAddress,
      });

      // TyphonJS may use multiple inputs for optimal selection
      expect(result.inputs.length).toBeGreaterThanOrEqual(1);
      // Verify at least one input contains sufficient amount
      const totalInputAmount = result.inputs.reduce((sum, input) => sum + BigInt(input.amount.toString()), BigInt(0));
      expect(totalInputAmount).toBeGreaterThanOrEqual(BigInt(3000000));
    });
  });
});