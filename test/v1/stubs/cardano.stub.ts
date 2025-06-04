import * as sinon from 'sinon';
import { TestProtocolSpec, ProtocolHTTPStub } from "../implementations";
import { CardanoCrypto } from "../../../src/crypto/cardano-crypto";

export class CardanoProtocolStub implements ProtocolHTTPStub {
  
  async registerStub(testProtocolSpec: TestProtocolSpec, protocol: any): Promise<void> {
    // Mock the data service to provide test UTXOs and balance
    if (protocol.dataService) {
      // Only stub if not already stubbed
      if (!protocol.dataService.getUtxos.isSinonProxy) {
        sinon.stub(protocol.dataService, 'getUtxos').callsFake(async (...args: any[]) => {
          // Return UTXOs for any address requested
          const address = args[0] as string || "any";
          
          // Always return UTXOs regardless of the address
          return [
            {
              txHash: "915f7bf0b7aa8a2892715cf7bbfbb1ee31cb05b33fe10bcb6b1f7cc4ebddf1e2",
              outputIndex: 0,
              amount: "5000000", // 5 ADA
              address: address
            },
            {
              txHash: "a1b2c3d4e5f6789abc123def456789abc123def456789abc123def456789abcd",
              outputIndex: 1,
              amount: "3000000", // 3 ADA
              address: address
            }
          ];
        });
      }

      // Only stub if not already stubbed
      if (!protocol.dataService.getBalance.isSinonProxy) {
        sinon.stub(protocol.dataService, 'getBalance').resolves({
          total: { value: "8000000", unit: "ADA" }, // 8 ADA total
          available: { value: "8000000", unit: "ADA" }
        });
      }

      // Only stub if not already stubbed
      if (!protocol.dataService.getProtocolParameters.isSinonProxy) {
        sinon.stub(protocol.dataService, 'getProtocolParameters').resolves({
          linearFee: {
            coefficient: "44",
            constant: "155381"
          },
          minUtxo: "1000000",
          poolDeposit: "500000000",
          keyDeposit: "2000000",
          minPoolCost: "340000000",
          maxTxSize: 16384,
          maxValSize: 5000,
          utxoCostPerWord: "4310"
        });
      }

      // Mock transaction status only if method exists
      if (typeof protocol.dataService.getTransactionStatus === 'function' && !protocol.dataService.getTransactionStatus.isSinonProxy) {
        sinon.stub(protocol.dataService, 'getTransactionStatus').callsFake(async (...args: any[]) => {
          const txHash = args[0] as string;
          // Return different statuses based on transaction hash for testing
          if (txHash.includes('pending')) {
            return { status: 'pending', confirmations: 0 };
          } else if (txHash.includes('failed')) {
            return { status: 'failed', confirmations: 0 };
          } else {
            return { status: 'confirmed', confirmations: 10 };
          }
        });
      }
    }

    // Mock CardanoCrypto methods for deterministic test signatures
    try {
      if (typeof CardanoCrypto.signWithKeypair === 'function' && !(CardanoCrypto.signWithKeypair as any).isSinonProxy) {
        sinon.stub(CardanoCrypto, 'signWithKeypair').callsFake(async (messageHash: Uint8Array, keypair: Uint8Array) => {
          // Create a deterministic test signature for consistency
          const privateKeyBytes = keypair.slice(0, 32); // Extract first 32 bytes as private key
          
          // Return a deterministic 64-byte signature
          const signature = new Uint8Array(64);
          for (let i = 0; i < 64; i++) {
            signature[i] = (privateKeyBytes[i % 32] + messageHash[i % messageHash.length]) % 256;
          }
          return signature;
        });
      }

      // Mock verification to match the signing approach
      if (typeof CardanoCrypto.verifySignature === 'function' && !(CardanoCrypto.verifySignature as any).isSinonProxy) {
        sinon.stub(CardanoCrypto, 'verifySignature').callsFake(async (signature: Uint8Array, messageHash: Uint8Array, publicKey: Uint8Array) => {
          // For testing, verify basic signature format (64 bytes, valid range)
          return signature.length === 64 && signature.every(byte => byte >= 0 && byte <= 255);
        });
      }
    } catch (error) {
      // If CardanoCrypto methods don't exist, skip mocking them
      console.warn('CardanoCrypto methods not available for mocking:', error);
    }

    // Mock block explorer functionality if present and not already stubbed
    if (typeof protocol.getBlockExplorerLinkForAddress === 'function' && !protocol.getBlockExplorerLinkForAddress.isSinonProxy) {
      sinon.stub(protocol, 'getBlockExplorerLinkForAddress').callsFake(async (...args: any[]) => {
        const address = args[0] as string;
        return `https://cardanoscan.io/address/${address}`;
      });
    }

    if (typeof protocol.getBlockExplorerLinkForTxId === 'function' && !protocol.getBlockExplorerLinkForTxId.isSinonProxy) {
      sinon.stub(protocol, 'getBlockExplorerLinkForTxId').callsFake(async (...args: any[]) => {
        const txId = args[0] as string;
        return `https://cardanoscan.io/transaction/${txId}`;
      });
    }
  }

  async noBalanceStub(testProtocolSpec: TestProtocolSpec, protocol: any): Promise<void> {
    if (protocol.dataService) {
      // Replace existing stubs with no balance versions
      if (protocol.dataService.getUtxos.isSinonProxy) {
        protocol.dataService.getUtxos.restore();
      }
      if (protocol.dataService.getBalance.isSinonProxy) {
        protocol.dataService.getBalance.restore();
      }
      
      sinon.stub(protocol.dataService, 'getUtxos').callsFake(async (...args: any[]) => {
        return []; // No UTXOs available
      });
      
      sinon.stub(protocol.dataService, 'getBalance').resolves({
        total: { value: "0", unit: "ADA" },
        available: { value: "0", unit: "ADA" }
      });
    }
  }
}