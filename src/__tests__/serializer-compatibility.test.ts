/**
 * Comprehensive tests for CardanoV3SerializerCompanion to validate QR code serialization
 * compatibility between AirGap Vault and AirGap Wallet.
 * 
 * These tests specifically target the sync issue between the two applications.
 */

import { CardanoV3SerializerCompanion } from '../serializer/cardano-v3-serializer';
import { CardanoProtocol } from '../protocol/cardano-protocol';
import { 
  UnsignedTransaction, 
  SignedTransaction
} from '@airgap/module-kit';
import { 
  TransactionSignRequest, 
  TransactionSignResponse,
  IACMessageType
} from '@airgap/serializer';

describe('CardanoV3SerializerCompanion - Serialization Compatibility', () => {
  let serializer: CardanoV3SerializerCompanion;
  let protocol: CardanoProtocol;
  let testKeyPair: any;
  let testPublicKey: string;

  beforeAll(async () => {
    serializer = new CardanoV3SerializerCompanion();
    protocol = new CardanoProtocol({ network: 'mainnet' });
    
    // Generate a test keypair for consistent testing
    testKeyPair = await protocol.generateKeyPair();
    testPublicKey = testKeyPair.publicKey.value;
  });

  describe('Transaction Sign Request Serialization', () => {
    it('should serialize and deserialize unsigned transactions correctly', async () => {
      // Create a realistic unsigned transaction with Cardano-specific fields
      const unsignedTransaction: any = {
        type: 'unsigned',
        cbor: '84a400818258203b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b700018182583900a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890821a00f42400a1581ca1b2c3d4e5f6789012345678901234567890123456789012345678901234567890a1446e69636501021a0001faa0031a00989680',
        hash: 'abc123def456',
        fee: '170000',
        inputs: [{
          txHash: '3b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b7',
          outputIndex: 0,
          amount: '5000000',
          address: 'addr1q8xkp4nz38drwcxvz6dy408glcl3r2vx9nwc4vx8fv6ej4yp8xkp4nz38drwcxvz6dy408glcl3r2vx9nwc4vx8fv6ej4yp8x'
        }],
        outputs: [{
          address: 'addr1q8xkp4nz38drwcxvz6dy408glcl3r2vx9nwc4vx8fv6ej4yp8xkp4nz38drwcxvz6dy408glcl3r2vx9nwc4vx8fv6ej4yp8x',
          amount: '4830000'
        }],
        changeOutput: 'addr1q8xkp4nz38drwcxvz6dy408glcl3r2vx9nwc4vx8fv6ej4yp8x'
      };

      // Test serialization to TransactionSignRequest
      const signRequest = await serializer.toTransactionSignRequest(
        'cardano',
        unsignedTransaction,
        testPublicKey,
        'airgap-wallet://callback'
      );

      // Validate the sign request structure
      expect(signRequest).toBeDefined();
      expect(signRequest.transaction).toEqual(unsignedTransaction);
      expect(signRequest.publicKey).toBe(testPublicKey);
      expect(signRequest.callbackURL).toBe('airgap-wallet://callback');

      // Test validation
      const isValid = await serializer.validateTransactionSignRequest('cardano', signRequest);
      expect(isValid).toBe(true);

      // Test deserialization back to UnsignedTransaction
      const deserializedTransaction = await serializer.fromTransactionSignRequest('cardano', signRequest);
      expect(deserializedTransaction).toEqual(unsignedTransaction);

      // Verify CBOR preservation (critical for Cardano)
      expect((deserializedTransaction as any).cbor).toBe(unsignedTransaction.cbor);
      expect((deserializedTransaction as any).hash).toBe(unsignedTransaction.hash);
    });

    it('should handle transactions without CBOR data', async () => {
      const unsignedTransaction: any = {
        type: 'unsigned',
        fee: '170000',
        inputs: [{
          txHash: '3b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b7',
          outputIndex: 0,
          amount: '5000000',
          address: 'addr1q8xkp4nz38drwcxvz6dy408glcl3r2vx9nwc4vx8fv6ej4yp8x'
        }],
        outputs: [{
          address: 'addr1q8xkp4nz38drwcxvz6dy408glcl3r2vx9nwc4vx8fv6ej4yp8x',
          amount: '4830000'
        }]
      };

      const signRequest = await serializer.toTransactionSignRequest(
        'cardano',
        unsignedTransaction,
        testPublicKey
      );

      expect(signRequest.transaction).toEqual(unsignedTransaction);
      expect(signRequest.publicKey).toBe(testPublicKey);

      const deserializedTransaction = await serializer.fromTransactionSignRequest('cardano', signRequest);
      expect(deserializedTransaction).toEqual(unsignedTransaction);
    });

    it('should reject invalid transaction sign requests', async () => {
      // Test with null transaction
      const invalidRequest1: TransactionSignRequest = {
        transaction: null as any,
        publicKey: testPublicKey
      };

      const isValid1 = await serializer.validateTransactionSignRequest('cardano', invalidRequest1);
      expect(isValid1).toBe(false);

      // Test with missing public key
      const invalidRequest2: TransactionSignRequest = {
        transaction: { type: 'unsigned' } as UnsignedTransaction,
        publicKey: '' as any
      };

      const isValid2 = await serializer.validateTransactionSignRequest('cardano', invalidRequest2);
      expect(isValid2).toBe(false);
    });
  });

  describe('Transaction Sign Response Serialization', () => {
    it('should serialize and deserialize signed transactions correctly', async () => {
      // Create a realistic signed transaction with CBOR and witnesses
      const signedTransaction: any = {
        type: 'signed',
        cbor: '84a500818258203b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b700018182583900a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890821a00f42400021a0001faa0031a00989680a100818258201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345840abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        signature: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        txHash: 'abc123def456789',
        witnesses: [{
          type: 'vkey_witness',
          publicKey: testPublicKey,
          signature: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        }]
      };

      const accountIdentifier = 'cardano-account-1';

      // Test serialization to TransactionSignResponse
      const signResponse = await serializer.toTransactionSignResponse(
        'cardano',
        signedTransaction,
        accountIdentifier
      );

      // Validate the sign response structure
      expect(signResponse).toBeDefined();
      expect(signResponse.accountIdentifier).toBe(accountIdentifier);
      expect(typeof signResponse.transaction).toBe('string');

      // The transaction should be JSON serialized
      const parsedTransaction = JSON.parse(signResponse.transaction);
      expect(parsedTransaction).toEqual(signedTransaction);

      // Test validation
      const isValid = await serializer.validateTransactionSignResponse('cardano', signResponse);
      expect(isValid).toBe(true);

      // Test deserialization back to SignedTransaction
      const deserializedTransaction = await serializer.fromTransactionSignResponse('cardano', signResponse);
      expect(deserializedTransaction).toEqual(signedTransaction);

      // Verify critical Cardano properties are preserved
      expect((deserializedTransaction as any).cbor).toBe(signedTransaction.cbor);
      expect((deserializedTransaction as any).signature).toBe(signedTransaction.signature);
      expect((deserializedTransaction as any).txHash).toBe(signedTransaction.txHash);
      expect((deserializedTransaction as any).witnesses).toEqual(signedTransaction.witnesses);
    });

    it('should handle object format transaction responses', async () => {
      const signedTransaction: any = {
        type: 'signed',
        signature: 'test-signature-123',
        txHash: 'test-hash-456'
      };

      // Create a response with transaction as object (not string)
      const signResponse: TransactionSignResponse = {
        transaction: signedTransaction as any,
        accountIdentifier: 'test-account'
      };

      // Should handle object format correctly
      const deserializedTransaction = await serializer.fromTransactionSignResponse('cardano', signResponse);
      expect(deserializedTransaction).toEqual(signedTransaction);
    });

    it('should reject invalid transaction sign responses', async () => {
      // Test with null transaction
      const invalidResponse1: TransactionSignResponse = {
        transaction: null as any,
        accountIdentifier: 'test-account'
      };

      const isValid1 = await serializer.validateTransactionSignResponse('cardano', invalidResponse1);
      expect(isValid1).toBe(false);

      // Test with missing account identifier
      const invalidResponse2: TransactionSignResponse = {
        transaction: '{"type":"signed"}',
        accountIdentifier: null as any
      };

      const isValid2 = await serializer.validateTransactionSignResponse('cardano', invalidResponse2);
      expect(isValid2).toBe(false);
    });
  });

  describe('End-to-End Serialization Roundtrip', () => {
    it('should maintain data integrity through complete sign request/response cycle', async () => {
      // Step 1: Create an unsigned transaction (AirGap Vault)
      const originalUnsignedTx: any = {
        type: 'unsigned',
        cbor: '84a400818258203b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b700018182583900a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890821a00f42400021a0001faa0031a00989680',
        hash: 'test-hash-123',
        fee: '170000',
        inputs: [{
          txHash: '3b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b7',
          outputIndex: 0,
          amount: '5000000',
          address: 'addr1q8test123'
        }],
        outputs: [{
          address: 'addr1q8test456',
          amount: '4830000'
        }]
      };

      // Step 2: Serialize to sign request (for QR code)
      const signRequest = await serializer.toTransactionSignRequest(
        'cardano',
        originalUnsignedTx,
        testPublicKey,
        'airgap-wallet://callback'
      );

      // Step 3: Simulate QR code transmission by JSON serialization
      const qrCodeData = JSON.stringify(signRequest);
      const reconstructedSignRequest = JSON.parse(qrCodeData) as TransactionSignRequest;

      // Step 4: Deserialize sign request (AirGap Wallet)
      const receivedUnsignedTx = await serializer.fromTransactionSignRequest('cardano', reconstructedSignRequest);

      // Step 5: Sign the transaction (simulation)
      const signedTx = await protocol.signTransactionWithSecretKey(receivedUnsignedTx, testKeyPair.secretKey);

      // Step 6: Serialize to sign response (for return QR code)
      const signResponse = await serializer.toTransactionSignResponse(
        'cardano',
        signedTx,
        'test-account-identifier'
      );

      // Step 7: Simulate return QR code transmission
      const returnQrData = JSON.stringify(signResponse);
      const reconstructedSignResponse = JSON.parse(returnQrData) as TransactionSignResponse;

      // Step 8: Deserialize sign response (AirGap Vault)
      const finalSignedTx = await serializer.fromTransactionSignResponse('cardano', reconstructedSignResponse);

      // Verify data integrity throughout the entire process
      expect((receivedUnsignedTx as any).cbor).toBe(originalUnsignedTx.cbor);
      expect((receivedUnsignedTx as any).hash).toBe(originalUnsignedTx.hash);
      expect((receivedUnsignedTx as any).fee).toBe(originalUnsignedTx.fee);
      expect(finalSignedTx.type).toBe('signed');
      expect((finalSignedTx as any).signature).toBeDefined();
      expect((finalSignedTx as any).txHash).toBeDefined();
    });

    it('should handle complex transactions with metadata and witnesses', async () => {
      const complexUnsignedTx: any = {
        type: 'unsigned',
        cbor: '84a500818258203b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b700018282583900a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890821a00f42400825839009876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210821a00989680021a0001faa0031a01312d00075820abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
        hash: 'complex-hash-789',
        fee: '200000',
        inputs: [{
          txHash: '3b40265111d8bb3c3c608d95b3a0bf83461ace32d79336579a1939b3aad1c0b7',
          outputIndex: 0,
          amount: '10000000',
          address: 'addr1q8complex123'
        }],
        outputs: [{
          address: 'addr1q8complex456',
          amount: '1000000'
        }, {
          address: 'addr1q8complex789',
          amount: '8800000'
        }],
        metadata: {
          '674': {
            'msg': ['Test transaction with metadata']
          }
        }
      };

      // Test the complete cycle with complex transaction
      const signRequest = await serializer.toTransactionSignRequest(
        'cardano',
        complexUnsignedTx,
        testPublicKey
      );

      const qrData = JSON.stringify(signRequest);
      const reconstructedRequest = JSON.parse(qrData);
      const receivedTx = await serializer.fromTransactionSignRequest('cardano', reconstructedRequest);

      // Verify complex transaction data is preserved
      expect((receivedTx as any).cbor).toBe(complexUnsignedTx.cbor);
      expect((receivedTx as any).metadata).toEqual(complexUnsignedTx.metadata);
      expect((receivedTx as any).outputs).toHaveLength(2);
      expect((receivedTx as any).outputs).toEqual(complexUnsignedTx.outputs);
    });
  });

  describe('Schema Validation', () => {
    it('should have correct schema configurations', () => {
      expect(serializer.schemas).toHaveLength(2);
      
      const signRequestSchema = serializer.schemas.find(s => s.type === IACMessageType.TransactionSignRequest);
      const signResponseSchema = serializer.schemas.find(s => s.type === IACMessageType.TransactionSignResponse);
      
      expect(signRequestSchema).toBeDefined();
      expect(signResponseSchema).toBeDefined();
      expect(signRequestSchema?.protocolIdentifier).toBe('cardano');
      expect(signResponseSchema?.protocolIdentifier).toBe('cardano');
    });

    it('should validate schemas correctly', () => {
      const signRequestSchema = serializer.schemas[0];
      const schema = signRequestSchema.schema.schema;
      
      expect(schema.$ref).toBe('#/definitions/TransactionSignRequest');
      expect(schema.definitions.TransactionSignRequest.required).toContain('transaction');
      expect(schema.definitions.TransactionSignRequest.required).toContain('publicKey');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON in transaction responses gracefully', async () => {
      const invalidResponse: TransactionSignResponse = {
        transaction: 'invalid-json-{broken',
        accountIdentifier: 'test-account'
      };

      await expect(
        serializer.fromTransactionSignResponse('cardano', invalidResponse)
      ).rejects.toThrow();
    });

    it('should handle empty transaction data', async () => {
      const emptyUnsignedTx: any = {
        type: 'unsigned'
      };

      const signRequest = await serializer.toTransactionSignRequest(
        'cardano',
        emptyUnsignedTx,
        testPublicKey
      );

      expect(signRequest.transaction).toEqual(emptyUnsignedTx);
      
      const receivedTx = await serializer.fromTransactionSignRequest('cardano', signRequest);
      expect(receivedTx).toEqual(emptyUnsignedTx);
    });

    it('should preserve transaction type throughout serialization', async () => {
      const unsignedTx: any = {
        type: 'unsigned',
        cbor: 'test-cbor'
      };

      const signRequest = await serializer.toTransactionSignRequest('cardano', unsignedTx, testPublicKey);
      const receivedTx = await serializer.fromTransactionSignRequest('cardano', signRequest);
      
      expect(receivedTx.type).toBe('unsigned');

      const signedTx: any = {
        type: 'signed',
        signature: 'test-signature'
      };

      const signResponse = await serializer.toTransactionSignResponse('cardano', signedTx, 'test-account');
      const receivedSignedTx = await serializer.fromTransactionSignResponse('cardano', signResponse);
      
      expect(receivedSignedTx.type).toBe('signed');
    });
  });
});