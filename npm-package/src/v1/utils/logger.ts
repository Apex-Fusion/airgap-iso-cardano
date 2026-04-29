/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private static level: LogLevel =
    process.env.NODE_ENV === "test" ? LogLevel.ERROR : LogLevel.INFO;

  static setLevel(level: LogLevel): void {
    this.level = level;
  }

  static error(message: string, error?: Error): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error?.stack || "");
    }
  }

  static warn(message: string): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`);
    }
  }

  static info(message: string): void {
    if (this.level >= LogLevel.INFO) {
      console.info(`[INFO] ${message}`);
    }
  }

  static debug(message: string, data?: any): void {
    if (this.level >= LogLevel.DEBUG) {
      console.debug(`[DEBUG] ${message}`, data || "");
    }
  }

  // Security: Never log sensitive data
  static sanitizeForLog(data: any): any {
    if (typeof data === "object" && data !== null) {
      const sanitized = { ...data };
      const sensitiveKeys = [
        "secretKey",
        "privateKey",
        "mnemonic",
        "seed",
        "signature",
      ];

      for (const key of sensitiveKeys) {
        if (key in sanitized) {
          sanitized[key] = "[REDACTED]";
        }
      }
      return sanitized;
    }
    return data;
  }
}
