import { CardanoFeeEstimator } from '../transaction/fee-estimation';
import { CardanoDataService } from '../data/cardano-data-service';
import { types as TyphonTypes, utils as TyphonUtils } from '@stricahq/typhonjs';
import BigNumber from 'bignumber.js';

// Mock CardanoDataService
const mockDataService = {
  getProtocolParameters: jest.fn() as jest.MockedFunction<() => Promise<any>>,
  getAccountInfo: jest.fn(),
  broadcastTransaction: jest.fn(),
};

// Test address for mock data
const testAddress = 'addr_test1vqfrg4ncjqfrg4ncjqfrg4ncjqfrg4ncjqfrg4ncjqfrg4s4h3w2x';

describe('CardanoFeeEstimator', () => {
  let feeEstimator: CardanoFeeEstimator;

  beforeEach(() => {
    jest.clearAllMocks();
    feeEstimator = new CardanoFeeEstimator('mainnet', mockDataService as any);
  });

  describe('Protocol Parameter Fetching', () => {
    it('should fetch and cache real protocol parameters when data service is available', async () => {
      const mockNetworkParams = {
        min_fee_a: 44,
        min_fee_b: 155381,
        max_tx_size: 16384,
        utxo_cost_per_word: 4310,
        key_deposit: 2000000,
        pool_deposit: 500000000,
        min_utxo: 1000000,
      };

      mockDataService.getProtocolParameters.mockResolvedValue(mockNetworkParams);

      const params = await feeEstimator.getProtocolParameters();

      expect(mockDataService.getProtocolParameters).toHaveBeenCalledTimes(1);
      expect(params.minFeeA.toNumber()).toBe(mockNetworkParams.min_fee_a);
      expect(params.minFeeB.toNumber()).toBe(mockNetworkParams.min_fee_b);
      expect(feeEstimator.isUsingRealTimeParameters()).toBe(true);
    });

    it('should use cached parameters on subsequent calls', async () => {
      const mockNetworkParams = {
        min_fee_a: 44,
        min_fee_b: 155381,
        max_tx_size: 16384,
        utxo_cost_per_word: 4310,
        key_deposit: 2000000,
        pool_deposit: 500000000,
        min_utxo: 1000000,
      };

      mockDataService.getProtocolParameters.mockResolvedValue(mockNetworkParams);

      // First call
      await feeEstimator.getProtocolParameters();
      // Second call should use cache
      await feeEstimator.getProtocolParameters();

      expect(mockDataService.getProtocolParameters).toHaveBeenCalledTimes(1);
    });

    it('should fall back to default parameters when data service is unavailable', async () => {
      mockDataService.getProtocolParameters.mockRejectedValue(new Error('Network error'));

      const params = await feeEstimator.getProtocolParameters();

      expect(params.minFeeA.toNumber()).toBe(44);
      expect(params.minFeeB.toNumber()).toBe(155381);
      expect(feeEstimator.isUsingRealTimeParameters()).toBe(false);
    });

    it('should handle testnet vs mainnet parameters correctly', async () => {
      const testnetEstimator = new CardanoFeeEstimator('testnet');
      const params = await testnetEstimator.getProtocolParameters();

      expect(params.maxTxSize).toBe(16384); // Same for both networks
    });

    it('should refresh cache after expiry time', async () => {
      const mockNetworkParams = {
        min_fee_a: 44,
        min_fee_b: 155381,
        max_tx_size: 16384,
        utxo_cost_per_word: 4310,
        key_deposit: 2000000,
        pool_deposit: 500000000,
        min_utxo: 1000000,
      };
      
      mockDataService.getProtocolParameters.mockResolvedValue(mockNetworkParams);
      
      // First call
      await feeEstimator.getProtocolParameters();
      
      // Clear cache to simulate expiry
      feeEstimator.clearCache();
      
      // Second call should fetch again
      await feeEstimator.getProtocolParameters();

      expect(mockDataService.getProtocolParameters).toHaveBeenCalledTimes(2);
    });
  });

  describe('Fee Estimation', () => {
    it('should calculate correct fees based on inputs and outputs', async () => {
      // Create mock inputs and outputs
      const mockInputs: TyphonTypes.Input[] = [{
        txId: 'a'.repeat(64),
        index: 0,
        amount: new BigNumber('1000000'),
        tokens: [],
        address: TyphonUtils.getAddressFromString(testAddress) as TyphonTypes.ShelleyAddress
      }];
      
      const mockOutputs: TyphonTypes.Output[] = [{
        address: TyphonUtils.getAddressFromString(testAddress)!,
        amount: new BigNumber('500000'),
        tokens: []
      }];
      
      const estimation = await feeEstimator.estimateTransactionFee(mockInputs, mockOutputs);

      expect(estimation.fee.toNumber()).toBeGreaterThan(0);
      expect(estimation.breakdown.baseFee.toNumber()).toBeGreaterThan(0);
      expect(estimation.breakdown.sizeFee.toNumber()).toBeGreaterThan(0);
      expect(estimation.breakdown.scriptFee).toBeUndefined(); // No script
    });

    it('should provide accurate fee breakdown', async () => {
      const mockInputs: TyphonTypes.Input[] = [
        {
          txId: 'a'.repeat(64),
          index: 0,
          amount: new BigNumber('1000000'),
          tokens: [],
          address: TyphonUtils.getAddressFromString(testAddress) as TyphonTypes.ShelleyAddress
        },
        {
          txId: 'b'.repeat(64),
          index: 1,
          amount: new BigNumber('2000000'),
          tokens: [],
          address: TyphonUtils.getAddressFromString(testAddress) as TyphonTypes.ShelleyAddress
        }
      ];
      
      const mockOutputs: TyphonTypes.Output[] = [
        {
          address: TyphonUtils.getAddressFromString(testAddress)!,
          amount: new BigNumber('500000'),
          tokens: []
        },
        {
          address: TyphonUtils.getAddressFromString(testAddress)!,
          amount: new BigNumber('800000'),
          tokens: []
        }
      ];
      
      const estimation = await feeEstimator.estimateTransactionFee(mockInputs, mockOutputs);
      
      expect(estimation.fee.toNumber()).toBeGreaterThan(0);
      expect(estimation.minUtxo.toNumber()).toBeGreaterThan(0);
      expect(estimation.totalCost.toNumber()).toBeGreaterThan(estimation.fee.toNumber());
      
      // Fee should be sum of base + size fees
      const expectedFee = estimation.breakdown.baseFee.plus(estimation.breakdown.sizeFee);
      expect(estimation.fee.toNumber()).toBe(expectedFee.toNumber());
    });

    it('should calculate minimum UTXO correctly', async () => {
      const address = TyphonUtils.getAddressFromString(testAddress)!;
      const amount = new BigNumber('1000000');
      
      const minUtxo = await feeEstimator.calculateMinUtxo(address, amount);
      
      expect(minUtxo.toNumber()).toBeGreaterThan(0);
      expect(minUtxo.toNumber()).toBeLessThan(amount.toNumber());
    });

    it('should estimate simple payment fees', async () => {
      const fee = await feeEstimator.estimateSimplePaymentFee(1, 1, new BigNumber('1000000'));
      
      expect(fee.toNumber()).toBeGreaterThan(0);
      expect(fee.toNumber()).toBeLessThan(1000000); // Should be less than 1 ADA
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle offline mode gracefully (no data service)', async () => {
      const offlineEstimator = new CardanoFeeEstimator('mainnet'); // No data service
      
      const params = await offlineEstimator.getProtocolParameters();

      expect(params.minFeeA.toNumber()).toBe(44); // Should use default
      expect(offlineEstimator.isUsingRealTimeParameters()).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      mockDataService.getProtocolParameters.mockRejectedValue(new Error('Network timeout'));
      
      const params = await feeEstimator.getProtocolParameters();

      expect(params.minFeeA.toNumber()).toBe(44); // Should fall back to defaults
      expect(feeEstimator.isUsingRealTimeParameters()).toBe(false);
    });

    it('should handle minimal transaction gracefully', async () => {
      const mockInputs: TyphonTypes.Input[] = [];
      const mockOutputs: TyphonTypes.Output[] = [];
      
      const estimation = await feeEstimator.estimateTransactionFee(mockInputs, mockOutputs);
      
      // Should still have base fee even with empty inputs/outputs
      expect(estimation.fee.toNumber()).toBeGreaterThan(0);
    });

    it('should handle large transactions correctly', async () => {
      const mockInputs: TyphonTypes.Input[] = Array(10).fill(null).map((_, i) => ({
        txId: i.toString().repeat(64).substring(0, 64),
        index: i,
        amount: new BigNumber('1000000'),
        tokens: [],
        address: TyphonUtils.getAddressFromString(testAddress) as TyphonTypes.ShelleyAddress
      }));
      
      const mockOutputs: TyphonTypes.Output[] = Array(5).fill(null).map(() => ({
        address: TyphonUtils.getAddressFromString(testAddress)!,
        amount: new BigNumber('500000'),
        tokens: []
      }));
      
      const estimation = await feeEstimator.estimateTransactionFee(mockInputs, mockOutputs);
      
      expect(estimation.fee.toNumber()).toBeGreaterThan(0);
      expect(estimation.breakdown.sizeFee.toNumber()).toBeGreaterThan(0);
    });
  });

  describe('Real-Time Parameter Status', () => {
    it('should correctly report real-time status when using data service', async () => {
      const mockNetworkParams = {
        min_fee_a: 44,
        min_fee_b: 155381,
        max_tx_size: 16384,
        utxo_cost_per_word: 4310,
        key_deposit: 2000000,
        pool_deposit: 500000000,
        min_utxo: 1000000,
      };

      mockDataService.getProtocolParameters.mockResolvedValue(mockNetworkParams);

      await feeEstimator.getProtocolParameters();

      expect(feeEstimator.isUsingRealTimeParameters()).toBe(true);
    });

    it('should correctly report offline status when using defaults', async () => {
      mockDataService.getProtocolParameters.mockRejectedValue(new Error('Network error'));

      await feeEstimator.getProtocolParameters();

      expect(feeEstimator.isUsingRealTimeParameters()).toBe(false);
    });
  });
});