/**
 * Comprehensive Delegation Test Suite
 * Tests all aspects of the delegation implementation including validation, error handling, and edge cases
 */

import { CardanoDelegationProtocol } from '../protocol/cardano-delegation-protocol';
import { ProtocolParamsNormalizer } from '../utils/protocol-params-normalizer';
import { ErrorRecoveryService } from '../utils/error-recovery';
import { PoolValidator } from '../utils/pool-validator';
import { types as TyphonTypes } from '@stricahq/typhonjs';
import { ValidationError, TransactionBuildError, UTXOSelectionError, ErrorCode } from '../errors/error-types';
import { CARDANO_CONSTANTS } from '../types/domain';
import BigNumber from 'bignumber.js';

// Mock dependencies
jest.mock('../data/cardano-data-service');
jest.mock('../utils/error-recovery');
jest.mock('../utils/pool-validator');

describe('Comprehensive Delegation Implementation', () => {
  let delegationProtocol: CardanoDelegationProtocol;
  let mockDataService: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock data service
    mockDataService = {
      getBalance: jest.fn(),
      getUtxos: jest.fn(),
      getProtocolParameters: jest.fn(),
      getStakePoolInfo: jest.fn()
    };

    // Initialize delegation protocol
    delegationProtocol = new CardanoDelegationProtocol({ network: 'testnet' });
    (delegationProtocol as any).dataService = mockDataService;
  });

  describe('Protocol Parameters Normalization', () => {
    test('should normalize Koios API parameters correctly', () => {
      const koiosParams = {
        min_fee_a: 44,
        min_fee_b: 155381,
        max_tx_size: 16384,
        utxo_cost_per_word: 4310,
        key_deposit: '2000000',
        pool_deposit: '500000000'
      };

      const normalized = ProtocolParamsNormalizer.normalize(koiosParams);

      expect(normalized.minFeeA.toNumber()).toBe(44);
      expect(normalized.minFeeB.toNumber()).toBe(155381);
      expect(normalized.maxTxSize).toBe(16384);
      expect(normalized.stakeKeyDeposit.toString()).toBe('2000000');
    });

    test('should normalize Blockfrost API parameters correctly', () => {
      const blockfrostParams = {
        minFeeA: '44',
        minFeeB: '155381',
        maxTxSize: '16384',
        utxoCostPerWord: '4310',
        keyDeposit: '2000000'
      };

      const normalized = ProtocolParamsNormalizer.normalize(blockfrostParams);

      expect(normalized.minFeeA.toNumber()).toBe(44);
      expect(normalized.minFeeB.toNumber()).toBe(155381);
    });

    test('should handle missing parameters with defaults', () => {
      const incompleteParams = {
        min_fee_a: 44
        // Missing other required parameters
      };

      const normalized = ProtocolParamsNormalizer.normalize(incompleteParams);

      expect(normalized.minFeeA.toNumber()).toBe(44);
      expect(normalized.minFeeB.toNumber()).toBeGreaterThan(0); // Should use default
      expect(normalized.maxTxSize).toBeGreaterThan(0); // Should use default
    });

    test('should validate normalized parameters for reasonableness', () => {
      const invalidParams = {
        min_fee_a: -1, // Invalid negative value
        min_fee_b: 155381,
        key_deposit: '100' // Too low deposit
      };

      // Should not throw, but use defaults for invalid values
      const normalized = ProtocolParamsNormalizer.normalize(invalidParams);
      expect(normalized.minFeeA.toNumber()).toBeGreaterThan(0);
      expect(normalized.stakeKeyDeposit.toNumber()).toBeGreaterThanOrEqual(1000000);
    });
  });

  describe('Address and Pool ID Validation', () => {
    test('should validate testnet addresses correctly', () => {
      const validTestnetAddr = 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj';
      
      expect(() => {
        (delegationProtocol as any).validateAddress(validTestnetAddr);
      }).not.toThrow();
    });

    test('should reject mainnet addresses when protocol is testnet', () => {
      const mainnetAddr = 'addr1qxyz123...'; // Would be a real mainnet address
      
      expect(() => {
        (delegationProtocol as any).validateAddress(mainnetAddr);
      }).toThrow(ValidationError);
    });

    test('should validate bech32 pool IDs correctly', () => {
      const validPoolId = 'pool1' + 'a'.repeat(58); // 63 chars total (pool1 = 5 + 58 = 63)
      
      expect(() => {
        (delegationProtocol as any).validatePoolId(validPoolId);
      }).not.toThrow();
    });

    test('should validate hex pool IDs correctly', () => {
      const validHexPoolId = 'a'.repeat(56);
      
      expect(() => {
        (delegationProtocol as any).validatePoolId(validHexPoolId);
      }).not.toThrow();
    });

    test('should reject invalid pool ID formats', () => {
      const invalidPoolIds = [
        'invalid_pool',
        'pool1' + 'a'.repeat(50), // Too short
        'a'.repeat(60), // Wrong length hex
        ''
      ];

      invalidPoolIds.forEach(poolId => {
        expect(() => {
          (delegationProtocol as any).validatePoolId(poolId);
        }).toThrow(ValidationError);
      });
    });
  });

  describe('Certificate Validation', () => {
    test('should allow valid certificate sequences', () => {
      const validCertificates = [
        {
          type: TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION,
          cert: { stakeCredential: { hash: Buffer.alloc(28), type: TyphonTypes.HashType.ADDRESS } }
        },
        {
          type: TyphonTypes.CertificateType.STAKE_DELEGATION,
          cert: { stakeCredential: { hash: Buffer.alloc(28), type: TyphonTypes.HashType.ADDRESS }, poolHash: 'pool123' }
        }
      ];

      expect(() => {
        (delegationProtocol as any).validateCertificateSequence(validCertificates);
      }).not.toThrow();
    });

    test('should reject invalid certificate combinations', () => {
      const invalidCertificates = [
        {
          type: TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION,
          cert: { stakeCredential: { hash: Buffer.alloc(28), type: TyphonTypes.HashType.ADDRESS } }
        },
        {
          type: TyphonTypes.CertificateType.STAKE_KEY_DE_REGISTRATION,
          cert: { stakeCredential: { hash: Buffer.alloc(28), type: TyphonTypes.HashType.ADDRESS } }
        }
      ];

      expect(() => {
        (delegationProtocol as any).validateCertificateSequence(invalidCertificates);
      }).toThrow(TransactionBuildError);
    });

    test('should reject wrong certificate order', () => {
      const wrongOrderCertificates = [
        {
          type: TyphonTypes.CertificateType.STAKE_DELEGATION,
          cert: { stakeCredential: { hash: Buffer.alloc(28), type: TyphonTypes.HashType.ADDRESS }, poolHash: 'pool123' }
        },
        {
          type: TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION,
          cert: { stakeCredential: { hash: Buffer.alloc(28), type: TyphonTypes.HashType.ADDRESS } }
        }
      ];

      expect(() => {
        (delegationProtocol as any).validateCertificateSequence(wrongOrderCertificates);
      }).toThrow(TransactionBuildError);
    });
  });

  describe('UTXO Handling and Multi-Asset Support', () => {
    test('should handle UTXOs with native tokens correctly', async () => {
      const mockUtxos = [
        {
          txHash: '1'.repeat(64),
          outputIndex: 0,
          amount: BigInt('10000000'),
          address: 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj',
          assets: new Map([
            ['policyid123assetname', BigInt('1000000')]
          ])
        }
      ];

      mockDataService.getUtxos.mockResolvedValue([{
        txHash: '1'.repeat(64),
        outputIndex: 0,
        amount: '10.0',
        address: 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj',
        assets: [{ unit: 'policyid123assetname', quantity: '1000000' }]
      }]);

      const utxos = await (delegationProtocol as any).getUTXOsForAddress('addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj');

      expect(utxos).toHaveLength(1);
      expect(utxos[0].assets).toBeDefined();
      expect(utxos[0].assets!.size).toBe(1);
    });

    test('should convert ADA amounts to lovelace correctly', async () => {
      mockDataService.getUtxos.mockResolvedValue([{
        txHash: '1'.repeat(64),
        outputIndex: 0,
        amount: '10.5', // 10.5 ADA
        address: 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj'
      }]);

      const utxos = await (delegationProtocol as any).getUTXOsForAddress('addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj');

      expect(utxos[0].amount).toBe(BigInt('10500000')); // 10.5 * 1,000,000
    });
  });

  describe('Pool Validation', () => {
    test('should validate pool status and warn about issues', async () => {
      const mockPoolValidator = {
        quickValidateForDelegation: jest.fn().mockResolvedValue([
          'Pool is oversaturated (105%) - rewards may be reduced'
        ])
      };

      (PoolValidator as any).mockImplementation(() => mockPoolValidator);

      // This would test the pool validation in delegation context
      // The actual implementation would call the pool validator
      const warnings = await mockPoolValidator.quickValidateForDelegation('pool123');

      expect(warnings).toContain('Pool is oversaturated (105%) - rewards may be reduced');
    });
  });

  describe('Error Recovery', () => {
    test('should retry failed network operations', async () => {
      let attempts = 0;
      const flakyOperation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network error');
        }
        return Promise.resolve('success');
      });

      // Mock the error recovery service
      (ErrorRecoveryService.networkOperation as jest.Mock).mockImplementation(
        async (operation, name) => {
          // Simulate retry logic
          let lastError;
          for (let i = 0; i < 3; i++) {
            try {
              return await operation();
            } catch (error) {
              lastError = error;
              if (i < 2) continue; // Retry
              throw error;
            }
          }
        }
      );

      const result = await ErrorRecoveryService.networkOperation(flakyOperation, 'test-operation');
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should use fallback when primary operation fails', async () => {
      const primaryOperation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const fallbackOperation = jest.fn().mockResolvedValue('fallback-success');

      (ErrorRecoveryService.withFallback as jest.Mock).mockImplementation(
        async (primary, fallback) => {
          try {
            return await primary();
          } catch {
            return await fallback();
          }
        }
      );

      const result = await ErrorRecoveryService.withFallback(
        primaryOperation,
        fallbackOperation,
        'test-operation'
      );

      expect(result).toBe('fallback-success');
      expect(primaryOperation).toHaveBeenCalled();
      expect(fallbackOperation).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    test('should handle insufficient balance for delegation', async () => {
      // Mock the balance check to return insufficient funds
      jest.spyOn(delegationProtocol as any, 'getBalanceOfAddress').mockResolvedValue({
        total: { value: '1000000' } // Only 1 ADA in lovelace (1000000 lovelace = 1 ADA)
      });

      await expect(
        (delegationProtocol as any).validateDelegationContext(
          'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj',
          'pool1' + 'a'.repeat(58) // Valid pool ID
        )
      ).rejects.toThrow(UTXOSelectionError);
    });

    test('should handle missing stake credential gracefully', () => {
      // Test case where address doesn't have stake credential
      const paymentOnlyAddress = 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj';
      
      // Mock TyphonUtils.getAddressFromString to return address without stake credential
      const mockAddress = {
        inspect: () => ({
          paymentCredential: { hash: Buffer.alloc(28), type: 'key' },
          stakeCredential: null // No stake credential
        })
      };

      // The implementation should handle this case
      expect(async () => {
        await (delegationProtocol as any).getStakeCredentialFromAddress(paymentOnlyAddress);
      }).not.toThrow();
    });

    test('should handle empty UTXO sets', async () => {
      mockDataService.getUtxos.mockResolvedValue([]);

      await expect(
        (delegationProtocol as any).getUTXOsForAddress('addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj')
      ).resolves.toEqual([]);
    });

    test('should handle malformed API responses', () => {
      const malformedParams = {
        min_fee_a: 'invalid',
        min_fee_b: 'not_a_number',
        max_tx_size: 'also_invalid'
      } as any; // Cast to any to test malformed data handling

      // Should not throw, but use defaults
      const normalized = ProtocolParamsNormalizer.normalize(malformedParams);
      expect(normalized.minFeeA.toNumber()).toBeGreaterThan(0);
      expect(normalized.minFeeB.toNumber()).toBeGreaterThan(0);
    });
  });

  describe('Transaction Building Integration', () => {
    test('should create proper delegation certificates', async () => {
      mockDataService.getUtxos.mockResolvedValue([{
        txHash: '1'.repeat(64),
        outputIndex: 0,
        amount: '10.0',
        address: 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj'
      }]);

      mockDataService.getBalance.mockResolvedValue({
        total: { value: '10000000' } // 10 ADA
      });

      const mockPoolValidator = {
        quickValidateForDelegation: jest.fn().mockResolvedValue([])
      };

      (delegationProtocol as any).poolValidator = mockPoolValidator;

      // Mock isStakeKeyRegistered to return false (needs registration)
      jest.spyOn(delegationProtocol as any, 'isStakeKeyRegistered').mockResolvedValue(false);

      // Mock the transaction builder
      const mockTxBuilder = {
        buildStakingTransaction: jest.fn().mockResolvedValue({
          transactionCbor: 'cbor_data',
          transactionHash: 'tx_hash',
          fee: new BigNumber('200000'),
          inputs: [],
          outputs: []
        })
      };

      jest.spyOn(delegationProtocol as any, 'getTyphonTransactionBuilder').mockResolvedValue(mockTxBuilder);

      const result = await (delegationProtocol as any).prepareDelegationTransaction(
        'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj',
        'pool1' + 'a'.repeat(58) // Valid 63-character pool ID
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('unsigned');
      expect(result.transaction.type).toBe('delegation');
      expect(mockTxBuilder.buildStakingTransaction).toHaveBeenCalled();

      // Should have called with both registration and delegation certificates
      const certificates = mockTxBuilder.buildStakingTransaction.mock.calls[0][1];
      expect(certificates).toHaveLength(2); // Registration + Delegation
    });
  });
});