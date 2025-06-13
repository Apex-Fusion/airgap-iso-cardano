/**
 * TyphonJS-Optimized UTXO selector for Cardano
 * Simplified implementation leveraging TyphonJS Transaction class for optimal selection
 */

import { ErrorCode, UTXOSelectionError, ValidationError } from "../errors/error-types";
import { Logger } from "../utils";
import { utils as TyphonUtils } from '@stricahq/typhonjs';
// BigNumber available when needed

export interface UTXO {
  txHash: string;
  outputIndex: number;
  amount: bigint;
  address: string;
  assets?: Map<string, bigint>; // Native tokens: policyId.assetName -> amount
}

export interface UTXOSelectionResult {
  selectedUtxos: UTXO[];
  totalAmount: bigint;
  changeAmount: bigint;
  selectionStrategy: string;
}

/**
 * TyphonJS-optimized UTXO selection
 * Uses proven algorithms optimized for TyphonJS Transaction class
 */
export class UTXOSelector {
  private static readonly MIN_UTXO_VALUE = BigInt(1000000); // 1 ADA minimum
  private static readonly MAX_INPUTS = 20; // Reasonable limit for transaction inputs

  /**
   * Select UTXOs using optimized largest-first strategy
   * (TyphonJS Transaction class internally uses similar optimization)
   */
  async selectUtxos(
    availableUtxos: UTXO[],
    requiredAmount: bigint,
    changeAddress: string
  ): Promise<UTXOSelectionResult> {
    try {
      Logger.debug("Starting TyphonJS-optimized UTXO selection", {
        availableCount: availableUtxos.length,
        requiredAmount: requiredAmount.toString(),
      });

      // Validate inputs
      this.validateInputs(availableUtxos, requiredAmount, changeAddress);

      // Use efficient largest-first selection (matches TyphonJS internal logic)
      return await this.selectWithLargestFirst(availableUtxos, requiredAmount);
    } catch (error) {
      if (error instanceof UTXOSelectionError) {
        throw error;
      }
      throw new UTXOSelectionError(
        ErrorCode.UTXO_SELECTION_FAILED,
        `TyphonJS UTXO selection failed: ${(error as Error).message}`,
        {}
      );
    }
  }

  /**
   * Optimized largest-first selection matching TyphonJS algorithms
   */
  private async selectWithLargestFirst(
    availableUtxos: UTXO[],
    requiredAmount: bigint
  ): Promise<UTXOSelectionResult> {
    // Sort by amount (largest first) - same strategy as TyphonJS
    const sortedUtxos = [...availableUtxos].sort((a, b) => 
      a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0
    );

    let selectedUtxos: UTXO[] = [];
    let totalAmount = BigInt(0);

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      totalAmount += utxo.amount;

      if (totalAmount >= requiredAmount) {
        const changeAmount = totalAmount - requiredAmount;
        return {
          selectedUtxos,
          totalAmount,
          changeAmount,
          selectionStrategy: "typhonjs-optimized",
        };
      }

      // Limit inputs for transaction size optimization
      if (selectedUtxos.length >= UTXOSelector.MAX_INPUTS) {
        break;
      }
    }

    throw new UTXOSelectionError(
      ErrorCode.INSUFFICIENT_FUNDS,
      "Insufficient funds for transaction",
      {
        available: this.getTotalAmount(availableUtxos),
        required: requiredAmount,
      }
    );
  }

  /**
   * Validate UTXO selection inputs
   */
  private validateInputs(
    availableUtxos: UTXO[],
    requiredAmount: bigint,
    changeAddress: string
  ): void {
    if (!availableUtxos || availableUtxos.length === 0) {
      throw new ValidationError(
        ErrorCode.INVALID_INPUT,
        "No UTXOs available for selection"
      );
    }

    if (requiredAmount <= 0) {
      throw new ValidationError(
        ErrorCode.INVALID_AMOUNT,
        "Required amount must be positive"
      );
    }

    if (!changeAddress || typeof changeAddress !== "string") {
      throw new ValidationError(
        ErrorCode.INVALID_ADDRESS,
        "Valid change address is required"
      );
    }

    // Validate change address using TyphonJS
    try {
      TyphonUtils.getAddressFromString(changeAddress);
    } catch (error) {
      throw new ValidationError(
        ErrorCode.INVALID_ADDRESS,
        `Invalid change address: ${(error as Error).message}`
      );
    }

    // Check if total available amount covers the requirement
    const totalAvailable = this.getTotalAmount(availableUtxos);
    if (totalAvailable < requiredAmount) {
      throw new UTXOSelectionError(
        ErrorCode.INSUFFICIENT_FUNDS,
        "Insufficient funds in available UTXOs",
        {
          available: totalAvailable,
          required: requiredAmount,
        }
      );
    }
  }

  /**
   * Calculate total amount from UTXOs
   */
  private getTotalAmount(utxos: UTXO[]): bigint {
    return utxos.reduce((total, utxo) => total + utxo.amount, BigInt(0));
  }

  /**
   * Enhanced UTXO selection with native asset support
   */
  async selectUtxosWithAssets(
    availableUtxos: UTXO[],
    requiredAda: bigint,
    requiredAssets: Map<string, bigint>,
    changeAddress: string
  ): Promise<UTXOSelectionResult> {
    try {
      Logger.debug("Starting TyphonJS asset-aware UTXO selection", {
        availableCount: availableUtxos.length,
        requiredAda: requiredAda.toString(),
        requiredAssetCount: requiredAssets.size,
      });

      // Select UTXOs containing required assets first
      const assetUtxos = this.selectUtxosForAssets(availableUtxos, requiredAssets);
      let selectedUtxos = [...assetUtxos];
      let totalAda = this.getTotalAmount(selectedUtxos);

      // Add more UTXOs if needed for ADA requirement
      if (totalAda < requiredAda) {
        const remainingAda = requiredAda - totalAda;
        const remainingUtxos = availableUtxos.filter(
          (utxo) => !selectedUtxos.includes(utxo)
        );

        const additionalSelection = await this.selectUtxos(
          remainingUtxos,
          remainingAda,
          changeAddress
        );

        selectedUtxos = [...selectedUtxos, ...additionalSelection.selectedUtxos];
        totalAda = this.getTotalAmount(selectedUtxos);
      }

      const changeAmount = totalAda - requiredAda;

      return {
        selectedUtxos,
        totalAmount: totalAda,
        changeAmount,
        selectionStrategy: "typhonjs-asset-aware",
      };
    } catch (error) {
      throw new UTXOSelectionError(
        ErrorCode.UTXO_SELECTION_FAILED,
        `TyphonJS asset-aware UTXO selection failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * Select UTXOs that contain specific assets
   */
  private selectUtxosForAssets(
    availableUtxos: UTXO[],
    requiredAssets: Map<string, bigint>
  ): UTXO[] {
    const selectedUtxos: UTXO[] = [];
    const remainingAssets = new Map(requiredAssets);

    for (const utxo of availableUtxos) {
      if (!utxo.assets || utxo.assets.size === 0) continue;

      let utxoUseful = false;
      for (const [assetId, requiredAmount] of remainingAssets) {
        const availableAmount = utxo.assets.get(assetId) || BigInt(0);
        if (availableAmount > 0) {
          utxoUseful = true;
          const usedAmount = availableAmount >= requiredAmount
            ? requiredAmount
            : availableAmount;
          
          const newRequired = requiredAmount - usedAmount;
          if (newRequired <= 0) {
            remainingAssets.delete(assetId);
          } else {
            remainingAssets.set(assetId, newRequired);
          }
        }
      }

      if (utxoUseful) {
        selectedUtxos.push(utxo);
      }

      if (remainingAssets.size === 0) {
        break;
      }
    }

    if (remainingAssets.size > 0) {
      const missingAssets = Array.from(remainingAssets.keys());
      throw new UTXOSelectionError(
        ErrorCode.INSUFFICIENT_FUNDS,
        `Missing required assets: ${missingAssets.join(", ")}`
      );
    }

    return selectedUtxos;
  }
}