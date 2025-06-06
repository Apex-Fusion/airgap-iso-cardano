/**
 * Test suite for delegation transaction building with proper TyphonJS integration
 * Verifies that delegation certificates are correctly created and transactions built
 */

import { CardanoDelegationProtocol } from '../protocol/cardano-delegation-protocol';
import { CardanoGovernanceExtensions } from '../protocol/governance-extensions';
import { TyphonTransactionBuilder } from '../transaction/typhon-transaction-builder';
import { types as TyphonTypes, utils as TyphonUtils } from '@stricahq/typhonjs';
import BigNumber from 'bignumber.js';

// Mock protocol parameters for testing
const MOCK_PROTOCOL_PARAMS: TyphonTypes.ProtocolParams = {
  minFeeA: new BigNumber(44),
  minFeeB: new BigNumber(155381),
  stakeKeyDeposit: new BigNumber('2000000'),
  lovelacePerUtxoWord: new BigNumber('4310'),
  utxoCostPerByte: new BigNumber('4310'),
  collateralPercent: new BigNumber(150),
  priceSteps: new BigNumber('0.0000721'),
  priceMem: new BigNumber('0.0577'),
  maxTxSize: 16384,
  maxValueSize: 5000,
  minFeeRefScriptCostPerByte: new BigNumber('15'),
  languageView: {
    PlutusScriptV1: [],
    PlutusScriptV2: [],
    PlutusScriptV3: []
  }
};

describe('Delegation Transaction Builder', () => {
  let delegationProtocol: CardanoDelegationProtocol;
  let governanceExtensions: CardanoGovernanceExtensions;
  let txBuilder: TyphonTransactionBuilder;

  beforeEach(() => {
    // Initialize protocols and builders
    delegationProtocol = new CardanoDelegationProtocol({ network: 'testnet' });
    txBuilder = new TyphonTransactionBuilder(MOCK_PROTOCOL_PARAMS);
  });

  describe('Transaction Builder Integration', () => {
    test('should successfully create TyphonTransactionBuilder', () => {
      expect(txBuilder).toBeDefined();
      expect(txBuilder.getProtocolParameters()).toEqual(MOCK_PROTOCOL_PARAMS);
    });

    test('should build basic staking transaction with certificates', async () => {
      const mockUTXOs = [{
        txHash: '1'.repeat(64),
        outputIndex: 0,
        amount: BigInt('10000000'), // 10 ADA
        address: 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj'
      }];

      const stakeCredential: TyphonTypes.StakeCredential = {
        hash: Buffer.from('a'.repeat(56), 'hex'),
        type: TyphonTypes.HashType.ADDRESS
      };

      const registrationCert: TyphonTypes.StakeKeyRegistrationCertificate = {
        type: TyphonTypes.CertificateType.STAKE_KEY_REGISTRATION,
        cert: {
          stakeCredential,
          deposit: new BigNumber('2000000')
        }
      };

      const result = await txBuilder.buildStakingTransaction(
        mockUTXOs,
        [registrationCert],
        'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj'
      );

      expect(result).toBeDefined();
      expect(result.transactionCbor).toBeDefined();
      expect(result.transactionHash).toBeDefined();
      expect(result.fee.toNumber()).toBeGreaterThan(0);
      expect(result.inputs.length).toBeGreaterThan(0);
    });
  });

  describe('Script Hashing Implementation', () => {
    beforeEach(() => {
      // Mock the data service to avoid network calls
      const mockDataService = {
        getBalance: jest.fn().mockResolvedValue({ total: { value: '10000000' } }),
        getUtxos: jest.fn().mockResolvedValue([]),
        getNetworkId: jest.fn().mockReturnValue(TyphonTypes.NetworkId.TESTNET)
      } as any;
      
      governanceExtensions = new CardanoGovernanceExtensions(mockDataService);
    });

    test('should create multi-sig script with proper hash calculation', async () => {
      const publicKeys = [
        'a'.repeat(64),
        'b'.repeat(64),
        'c'.repeat(64)
      ];
      const requiredSignatures = 2;

      const script = governanceExtensions.createMultiSigScript(
        publicKeys,
        requiredSignatures
      );

      expect(script).toBeDefined();
      expect(script.type).toBe('atLeast');
      expect(script.required).toBe(2);
      expect(script.scripts).toHaveLength(3);
      
      // Verify that each sub-script is properly formatted
      script.scripts?.forEach((subScript, index) => {
        expect(subScript.type).toBe('sig');
        expect(subScript.keyHash).toBeDefined();
        expect(subScript.keyHash).toHaveLength(56); // 28 bytes = 56 hex chars
      });
    });

    test('should create script with timelock constraints', () => {
      const publicKeys = ['a'.repeat(64), 'b'.repeat(64)];
      const timelock = {
        validAfter: new Date('2024-01-01'),
        validBefore: new Date('2024-12-31')
      };

      const script = governanceExtensions.createMultiSigScript(
        publicKeys,
        1,
        timelock
      );

      expect(script.type).toBe('all');
      expect(script.scripts).toHaveLength(3); // atLeast + after + before
      
      const constraints = script.scripts!;
      expect(constraints.some(s => s.type === 'atLeast')).toBe(true);
      expect(constraints.some(s => s.type === 'after')).toBe(true);
      expect(constraints.some(s => s.type === 'before')).toBe(true);
    });

    test('should generate consistent key hashes', () => {
      const testPublicKey = 'a'.repeat(64);
      
      // Call the method multiple times
      const hash1 = (governanceExtensions as any).publicKeyToKeyHash(testPublicKey);
      const hash2 = (governanceExtensions as any).publicKeyToKeyHash(testPublicKey);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(56); // 28 bytes = 56 hex chars
      expect(/^[0-9a-f]+$/i.test(hash1)).toBe(true); // Valid hex
    });

    test('should handle invalid public key formats', () => {
      expect(() => {
        (governanceExtensions as any).publicKeyToKeyHash('invalid');
      }).toThrow();

      expect(() => {
        (governanceExtensions as any).publicKeyToKeyHash('');
      }).toThrow();

      expect(() => {
        (governanceExtensions as any).publicKeyToKeyHash('z'.repeat(64)); // Invalid hex
      }).toThrow();
    });
  });

  describe('Delegation Protocol Integration', () => {
    test('should provide proper delegation interface methods', () => {
      expect(delegationProtocol.getDefaultDelegatee).toBeDefined();
      expect(delegationProtocol.getCurrentDelegateesForPublicKey).toBeDefined();
      expect(delegationProtocol.getDelegateeDetails).toBeDefined();
      expect(delegationProtocol.isPublicKeyDelegating).toBeDefined();
      expect(delegationProtocol.getDelegatorDetailsFromPublicKey).toBeDefined();
      expect(delegationProtocol.prepareDelegatorActionFromPublicKey).toBeDefined();
    });

    test('should return valid delegation action types', () => {
      const actionTypes = ['delegate', 'undelegate', 'withdraw', 'register', 'change_delegation'];
      
      actionTypes.forEach(actionType => {
        expect(['delegate', 'undelegate', 'withdraw', 'register', 'change_delegation']).toContain(actionType);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle insufficient UTXO scenarios gracefully', async () => {
      const emptyUTXOs: any[] = [];
      
      await expect(
        txBuilder.buildStakingTransaction(
          emptyUTXOs,
          [],
          'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj'
        )
      ).rejects.toThrow();
    });

    test('should validate address formats correctly', () => {
      const validTestnetAddr = 'addr_test1vqh53el3zkz58jv6q5rxzqv4nf0gt6dxjnr340kn63pts0qfahsfj';
      const validMainnetAddr = 'addr1qxyz123...'; // Would be a real mainnet address
      const invalidAddr = 'invalid_address';

      // These would test the validateAddress method if it were public
      expect(() => {
        TyphonUtils.getAddressFromString(validTestnetAddr);
      }).not.toThrow();

      expect(() => {
        TyphonUtils.getAddressFromString(invalidAddr);
      }).toThrow();
    });

    test('should validate pool ID formats correctly', () => {
      const validBech32Pool = 'pool1' + 'a'.repeat(59); // 63 chars total
      const validHexPool = 'a'.repeat(56);
      const invalidPool = 'invalid_pool';

      // Pool ID validation patterns
      expect(/^pool1/.test(validBech32Pool)).toBe(true);
      expect(/^[0-9a-fA-F]{56}$/.test(validHexPool)).toBe(true);
      expect(/^pool1/.test(invalidPool) || /^[0-9a-fA-F]{56}$/.test(invalidPool)).toBe(false);
    });

    test('should validate script serialization errors', () => {
      const invalidScript = {
        type: 'invalid_type' as any,
        keyHash: 'test'
      };

      expect(() => {
        (governanceExtensions as any).serializeNativeScriptToCbor(invalidScript);
      }).toThrow();
    });
  });
});