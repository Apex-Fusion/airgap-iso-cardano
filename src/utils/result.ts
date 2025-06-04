/**
 * Result Type for Better Error Handling
 * Provides a functional approach to error handling without exceptions
 */

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export class ResultUtils {
  /**
   * Creates a successful result
   */
  static ok<T>(data: T): Result<T, never> {
    return { success: true, data };
  }

  /**
   * Creates a failed result
   */
  static error<E>(error: E): Result<never, E> {
    return { success: false, error };
  }

  /**
   * Wraps a function that might throw into a Result
   */
  static try<T>(fn: () => T): Result<T, Error> {
    try {
      return ResultUtils.ok(fn());
    } catch (error) {
      return ResultUtils.error(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Wraps an async function that might throw into a Result
   */
  static async tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      const data = await fn();
      return ResultUtils.ok(data);
    } catch (error) {
      return ResultUtils.error(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Maps the success value if the result is successful
   */
  static map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    if (result.success) {
      return ResultUtils.ok(fn(result.data));
    }
    return result as Result<U, E>;
  }

  /**
   * Maps the error value if the result is failed
   */
  static mapError<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F,
  ): Result<T, F> {
    if (!result.success) {
      return ResultUtils.error(fn((result as any).error));
    }
    return result as Result<T, F>;
  }

  /**
   * Chains operations on successful results
   */
  static flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>,
  ): Result<U, E> {
    if (result.success) {
      return fn(result.data);
    }
    return result as Result<U, E>;
  }

  /**
   * Combines multiple results into one
   */
  static combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const data: T[] = [];

    for (const result of results) {
      if (!result.success) {
        return result as Result<T[], E>;
      }
      data.push(result.data);
    }

    return ResultUtils.ok(data);
  }

  /**
   * Gets the value or throws the error
   */
  static unwrap<T, E>(result: Result<T, E>): T {
    if (result.success) {
      return result.data;
    }
    throw (result as any).error;
  }

  /**
   * Gets the value or returns a default
   */
  static unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (result.success) {
      return result.data;
    }
    return defaultValue;
  }

  /**
   * Gets the value or computes a default from the error
   */
  static unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
    if (result.success) {
      return result.data;
    }
    return fn((result as any).error);
  }

  /**
   * Checks if the result is successful
   */
  static isOk<T, E>(
    result: Result<T, E>,
  ): result is { success: true; data: T } {
    return result.success;
  }

  /**
   * Checks if the result is failed
   */
  static isError<T, E>(
    result: Result<T, E>,
  ): result is { success: false; error: E } {
    return !result.success;
  }

  /**
   * Converts a Promise that might reject to a Result
   */
  static async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
    try {
      const data = await promise;
      return ResultUtils.ok(data);
    } catch (error) {
      return ResultUtils.error(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Converts a Result to a Promise
   */
  static toPromise<T, E>(result: Result<T, E>): Promise<T> {
    if (result.success) {
      return Promise.resolve(result.data);
    }
    return Promise.reject((result as any).error);
  }
}

// Convenience type aliases
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Helper functions for common patterns
export const ok = ResultUtils.ok;
export const error = ResultUtils.error;
export const tryFn = ResultUtils.try;
export const tryAsync = ResultUtils.tryAsync;
