/**
 * Error Recovery and Retry Mechanisms
 * Provides intelligent retry logic for network operations and transaction building
 */

import { Logger } from './logger';
import { NetworkError } from '../errors/error-types';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  exponentialBackoff: boolean;
  retryableErrors: readonly string[];
}

export interface RetryContext {
  attempt: number;
  totalElapsed: number;
  lastError: Error;
  operation: string;
}

export type RetryableOperation<T> = () => Promise<T>;

/**
 * Default retry configurations for different operation types
 */
export const RETRY_CONFIGS = {
  NETWORK_OPERATION: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    exponentialBackoff: true,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'API_ERROR']
  },
  
  TRANSACTION_BUILDING: {
    maxAttempts: 2,
    baseDelay: 500,
    maxDelay: 2000,
    exponentialBackoff: false,
    retryableErrors: ['UTXO_SELECTION_FAILED', 'TRANSACTION_BUILD_FAILED']
  },
  
  PROTOCOL_PARAMS: {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    exponentialBackoff: true,
    retryableErrors: ['NETWORK_ERROR', 'API_ERROR', 'TIMEOUT_ERROR']
  }
} as const;

/**
 * Error Recovery Service with intelligent retry mechanisms
 */
export class ErrorRecoveryService {
  
  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: RetryableOperation<T>,
    config: RetryConfig,
    operationName: string = 'unknown'
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        Logger.debug('Executing operation with retry', { 
          operationName, 
          attempt, 
          maxAttempts: config.maxAttempts 
        });

        const result = await operation();
        
        if (attempt > 1) {
          Logger.info(`Operation ${operationName} succeeded after retry attempt ${attempt}`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        
        Logger.warn(`Operation ${operationName} failed attempt ${attempt}/${config.maxAttempts}: ${lastError.message}`);

        // Check if error is retryable
        if (!ErrorRecoveryService.isRetryableError(lastError, config)) {
          Logger.debug('Error is not retryable, failing immediately', { 
            operationName, 
            errorType: lastError.constructor.name 
          });
          throw lastError;
        }

        // Don't delay after last attempt
        if (attempt < config.maxAttempts) {
          const delay = ErrorRecoveryService.calculateDelay(attempt, config);
          Logger.debug('Waiting before retry', { operationName, delay, nextAttempt: attempt + 1 });
          await ErrorRecoveryService.delay(delay);
        }
      }
    }

    // All attempts failed
    const totalElapsed = Date.now() - startTime;
    Logger.error(`All retry attempts failed for ${operationName} after ${config.maxAttempts} attempts in ${totalElapsed}ms`);

    throw new Error(
      `Operation '${operationName}' failed after ${config.maxAttempts} attempts: ${lastError!.message}`
    );
  }

  /**
   * Network operation with automatic retry
   */
  static async networkOperation<T>(
    operation: RetryableOperation<T>,
    operationName: string = 'network-operation'
  ): Promise<T> {
    return ErrorRecoveryService.withRetry(
      operation,
      RETRY_CONFIGS.NETWORK_OPERATION,
      operationName
    );
  }

  /**
   * Transaction building with automatic retry
   */
  static async transactionBuilding<T>(
    operation: RetryableOperation<T>,
    operationName: string = 'transaction-building'
  ): Promise<T> {
    return ErrorRecoveryService.withRetry(
      operation,
      RETRY_CONFIGS.TRANSACTION_BUILDING,
      operationName
    );
  }

  /**
   * Protocol parameters fetch with automatic retry
   */
  static async protocolParams<T>(
    operation: RetryableOperation<T>,
    operationName: string = 'protocol-params'
  ): Promise<T> {
    return ErrorRecoveryService.withRetry(
      operation,
      RETRY_CONFIGS.PROTOCOL_PARAMS,
      operationName
    );
  }

  /**
   * Check if error is retryable based on configuration
   */
  private static isRetryableError(error: Error, config: RetryConfig): boolean {
    // Check error code for module errors
    if ('code' in error) {
      const errorCode = (error as any).code;
      return config.retryableErrors.includes(errorCode);
    }

    // Check error type for standard errors
    if (error instanceof NetworkError) {
      return config.retryableErrors.some(code => 
        code === 'NETWORK_ERROR' || code === 'API_ERROR' || code === 'TIMEOUT_ERROR'
      );
    }

    // Check error message for common retryable patterns
    const retryablePatterns = [
      /network.*error/i,
      /timeout/i,
      /connection.*reset/i,
      /temporary.*failure/i,
      /service.*unavailable/i,
      /rate.*limit/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Calculate delay for next retry attempt
   */
  private static calculateDelay(attempt: number, config: RetryConfig): number {
    if (!config.exponentialBackoff) {
      return Math.min(config.baseDelay, config.maxDelay);
    }

    // Exponential backoff with jitter
    const exponentialDelay = config.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const delay = exponentialDelay + jitter;

    return Math.min(delay, config.maxDelay);
  }

  /**
   * Promise-based delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Circuit breaker pattern for failing services
   */
  static createCircuitBreaker<T>(
    operation: RetryableOperation<T>,
    failureThreshold: number = 5,
    recoveryTimeout: number = 60000 // 1 minute
  ) {
    let failures = 0;
    let lastFailureTime = 0;
    let isOpen = false;

    return async (): Promise<T> => {
      // Check if circuit is open and recovery timeout has passed
      if (isOpen && Date.now() - lastFailureTime > recoveryTimeout) {
        isOpen = false;
        failures = 0;
        Logger.info('Circuit breaker reset - attempting recovery');
      }

      // If circuit is open, fail fast
      if (isOpen) {
        throw new Error('Circuit breaker is open - service temporarily unavailable');
      }

      try {
        const result = await operation();
        
        // Reset failure count on success
        if (failures > 0) {
          failures = 0;
          Logger.info('Circuit breaker recovered');
        }
        
        return result;
      } catch (error) {
        failures++;
        lastFailureTime = Date.now();

        // Open circuit if failure threshold reached
        if (failures >= failureThreshold) {
          isOpen = true;
          Logger.warn(`Circuit breaker opened due to repeated failures: ${failures}/${failureThreshold}`);
        }

        throw error;
      }
    };
  }

  /**
   * Graceful degradation helper
   */
  static async withFallback<T>(
    primaryOperation: RetryableOperation<T>,
    fallbackOperation: RetryableOperation<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (primaryError) {
      Logger.warn(`Primary operation ${operationName} failed, trying fallback: ${(primaryError as Error).message}`);

      try {
        const result = await fallbackOperation();
        Logger.info(`Fallback operation succeeded for ${operationName}`);
        return result;
      } catch (fallbackError) {
        Logger.error(`Both primary and fallback operations failed for ${operationName}`);

        // Throw the primary error as it's likely more relevant
        throw primaryError;
      }
    }
  }

  /**
   * Batch operation with partial failure handling
   */
  static async batchWithPartialFailure<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    maxConcurrency: number = 3,
    continueOnError: boolean = true
  ): Promise<{ successes: R[], failures: Array<{ item: T, error: Error }> }> {
    const successes: R[] = [];
    const failures: Array<{ item: T, error: Error }> = [];
    
    // Process items in batches
    for (let i = 0; i < items.length; i += maxConcurrency) {
      const batch = items.slice(i, i + maxConcurrency);
      
      const promises = batch.map(async (item) => {
        try {
          const result = await operation(item);
          return { success: true, result, item };
        } catch (error) {
          return { success: false, error: error as Error, item };
        }
      });

      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.success) {
          successes.push((result as any).result);
        } else {
          failures.push({ 
            item: (result as any).item, 
            error: (result as any).error 
          });
          
          if (!continueOnError) {
            throw (result as any).error;
          }
        }
      }
    }

    Logger.debug('Batch operation completed', { 
      total: items.length,
      successes: successes.length,
      failures: failures.length
    });

    return { successes, failures };
  }
}