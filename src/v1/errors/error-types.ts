/**
 * Enhanced error hierarchy for better error handling and debugging
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export enum ErrorCode {
  // UTXO Selection Errors
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  UTXO_SELECTION_FAILED = "UTXO_SELECTION_FAILED",
  INVALID_UTXO = "INVALID_UTXO",

  // Transaction Building Errors
  TRANSACTION_BUILD_FAILED = "TRANSACTION_BUILD_FAILED",
  INVALID_TRANSACTION_DATA = "INVALID_TRANSACTION_DATA",
  TRANSACTION_TOO_LARGE = "TRANSACTION_TOO_LARGE",

  // Cryptographic Errors
  INVALID_PRIVATE_KEY = "INVALID_PRIVATE_KEY",
  INVALID_PUBLIC_KEY = "INVALID_PUBLIC_KEY",
  SIGNATURE_FAILED = "SIGNATURE_FAILED",
  KEY_DERIVATION_FAILED = "KEY_DERIVATION_FAILED",

  // Validation Errors
  INVALID_ADDRESS = "INVALID_ADDRESS",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  INVALID_FEE = "INVALID_FEE",
  INVALID_INPUT = "INVALID_INPUT",
  INVALID_ASSET = "INVALID_ASSET",


  // Network/API Errors
  NETWORK_ERROR = "NETWORK_ERROR",
  API_ERROR = "API_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",

  // Configuration Errors
  INVALID_CONFIGURATION = "INVALID_CONFIGURATION",
  MISSING_CONFIGURATION = "MISSING_CONFIGURATION",

  // Script and Governance Errors
  SCRIPT_HASH_FAILED = "SCRIPT_HASH_FAILED",
  INVALID_SCRIPT_HASH = "INVALID_SCRIPT_HASH",
  SCRIPT_SERIALIZATION_FAILED = "SCRIPT_SERIALIZATION_FAILED",
  INVALID_SCRIPT_TYPE = "INVALID_SCRIPT_TYPE",
  KEY_HASH_FAILED = "KEY_HASH_FAILED",
  ADDRESS_GENERATION_FAILED = "ADDRESS_GENERATION_FAILED",

}

/**
 * Base error class with structured error information
 */
export abstract class CardanoModuleError extends Error {
  public readonly code: ErrorCode;
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly cause?: Error;

  constructor(
    code: ErrorCode,
    message: string,
    context: Record<string, any> = {},
    cause?: Error,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.cause = cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get sanitized error information safe for logging
   */
  public getSanitizedInfo(): {
    name: string;
    code: ErrorCode;
    message: string;
    timestamp: Date;
    context: Record<string, any>;
  } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      context: this.sanitizeContext(this.context),
    };
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(context)) {
      if (
        key.toLowerCase().includes("key") ||
        key.toLowerCase().includes("secret")
      ) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "bigint") {
        sanitized[key] = value.toString();
      } else if (value instanceof Buffer) {
        sanitized[key] = `Buffer(${value.length})`;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * UTXO Selection specific errors
 */
export class UTXOSelectionError extends CardanoModuleError {
  constructor(
    code:
      | ErrorCode.INSUFFICIENT_FUNDS
      | ErrorCode.UTXO_SELECTION_FAILED
      | ErrorCode.INVALID_UTXO,
    message: string,
    context: {
      required?: bigint;
      available?: bigint;
      utxoCount?: number;
      targetAmount?: bigint;
      feeEstimate?: bigint;
    } = {},
  ) {
    super(code, message, context);
  }

  static insufficientFunds(
    required: bigint,
    available: bigint,
  ): UTXOSelectionError {
    return new UTXOSelectionError(
      ErrorCode.INSUFFICIENT_FUNDS,
      `Insufficient funds: need ${required} lovelace, have ${available} lovelace`,
      { required, available },
    );
  }

  static selectionFailed(
    utxoCount: number,
    targetAmount: bigint,
  ): UTXOSelectionError {
    return new UTXOSelectionError(
      ErrorCode.UTXO_SELECTION_FAILED,
      `No viable UTXO selection strategy succeeded with ${utxoCount} UTXOs for ${targetAmount} lovelace`,
      { utxoCount, targetAmount },
    );
  }
}

/**
 * Transaction building specific errors
 */
export class TransactionBuildError extends CardanoModuleError {
  constructor(
    code:
      | ErrorCode.TRANSACTION_BUILD_FAILED
      | ErrorCode.INVALID_TRANSACTION_DATA
      | ErrorCode.TRANSACTION_TOO_LARGE,
    message: string,
    context: {
      inputCount?: number;
      outputCount?: number;
      transactionSize?: number;
      maxSize?: number;
    } = {},
  ) {
    super(code, message, context);
  }

  static buildFailed(
    reason: string,
    context: Record<string, any> = {},
  ): TransactionBuildError {
    return new TransactionBuildError(
      ErrorCode.TRANSACTION_BUILD_FAILED,
      `Transaction build failed: ${reason}`,
      context,
    );
  }

  static tooLarge(size: number, maxSize: number): TransactionBuildError {
    return new TransactionBuildError(
      ErrorCode.TRANSACTION_TOO_LARGE,
      `Transaction size ${size} exceeds maximum ${maxSize}`,
      { transactionSize: size, maxSize },
    );
  }
}

/**
 * Cryptographic operation errors
 */
export class CryptoOperationError extends CardanoModuleError {
  constructor(
    code:
      | ErrorCode.INVALID_PRIVATE_KEY
      | ErrorCode.INVALID_PUBLIC_KEY
      | ErrorCode.SIGNATURE_FAILED
      | ErrorCode.KEY_DERIVATION_FAILED
      | ErrorCode.ADDRESS_GENERATION_FAILED,
    message: string,
    context: Record<string, any> = {},
  ) {
    super(code, message, context);
  }

  static invalidPrivateKey(reason: string): CryptoOperationError {
    return new CryptoOperationError(
      ErrorCode.INVALID_PRIVATE_KEY,
      `Invalid private key: ${reason}`,
    );
  }

  static signatureFailed(reason: string): CryptoOperationError {
    return new CryptoOperationError(
      ErrorCode.SIGNATURE_FAILED,
      `Signature operation failed: ${reason}`,
    );
  }
}

/**
 * Validation specific errors
 */
export class ValidationError extends CardanoModuleError {
  constructor(
    code:
      | ErrorCode.INVALID_ADDRESS
      | ErrorCode.INVALID_AMOUNT
      | ErrorCode.INVALID_FEE
      | ErrorCode.INVALID_INPUT
      | ErrorCode.INVALID_ASSET
      | ErrorCode.SCRIPT_HASH_FAILED
      | ErrorCode.INVALID_SCRIPT_HASH
      | ErrorCode.SCRIPT_SERIALIZATION_FAILED
      | ErrorCode.INVALID_SCRIPT_TYPE
      | ErrorCode.KEY_HASH_FAILED
      | ErrorCode.ADDRESS_GENERATION_FAILED
      | ErrorCode.INVALID_PUBLIC_KEY,
    message: string,
    context: {
      field?: string;
      value?: any;
      expected?: string;
      output?: string;
      required?: string;
      provided?: string;
    } = {},
  ) {
    super(code, message, context);
  }

  static invalidAddress(address: string, reason: string): ValidationError {
    return new ValidationError(
      ErrorCode.INVALID_ADDRESS,
      `Invalid address: ${reason}`,
      { field: "address", value: address },
    );
  }

  static invalidInput(
    field: string,
    value: any,
    reason: string,
  ): ValidationError {
    return new ValidationError(
      ErrorCode.INVALID_INPUT,
      `Invalid ${field}: ${reason}`,
      { field, value },
    );
  }

  static invalidAmount(amount: any, reason: string): ValidationError {
    return new ValidationError(
      ErrorCode.INVALID_AMOUNT,
      `Invalid amount: ${reason}`,
      { field: "amount", value: amount },
    );
  }
}


/**
 * Network operation errors
 */
export class NetworkError extends CardanoModuleError {
  constructor(
    code:
      | ErrorCode.NETWORK_ERROR
      | ErrorCode.API_ERROR
      | ErrorCode.TIMEOUT_ERROR,
    message: string,
    context: {
      url?: string;
      statusCode?: number;
      timeout?: number;
    } = {},
  ) {
    super(code, message, context);
  }

  static timeout(timeout: number, url?: string): NetworkError {
    return new NetworkError(
      ErrorCode.TIMEOUT_ERROR,
      `Request timed out after ${timeout}ms`,
      { timeout, url },
    );
  }
}

/**
 * Legacy error types for backward compatibility
 */
export class CryptoError extends CryptoOperationError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(ErrorCode.SIGNATURE_FAILED, message, context);
  }
}

// Re-export for backward compatibility
export { CardanoModuleError as CardanoError };
