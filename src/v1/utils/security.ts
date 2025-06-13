// Pure JavaScript security utilities (JavascriptEngine compatible)
import { Logger } from "./logger";

/**
 * Security utilities for the AirGap Cardano module
 * Implements defense-in-depth security measures
 */
export class Security {
  private static readonly MAX_INPUT_LENGTH = 10000;
  private static readonly SUSPICIOUS_PATTERNS = [
    /script/gi,
    /<[^>]*>/g,
    /javascript:/gi,
    /data:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
  ];

  /**
   * Comprehensive input sanitization to prevent injection attacks
   */
  static sanitizeInput(
    input: string,
    maxLength: number = 10000,
    allowEmpty: boolean = false,
  ): string {
    if (typeof input !== "string") {
      throw new Error("Input must be a string");
    }

    if (!allowEmpty && !input) {
      throw new Error("Input must be a non-empty string");
    }

    const limit = maxLength;

    // Length check for DoS protection
    if (input.length > limit) {
      throw new Error(`Input too long: maximum ${limit} characters allowed`);
    }

    // Remove null bytes and control characters
    // eslint-disable-next-line no-control-regex
    let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Check for suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        Logger.warn("Suspicious pattern detected in input");
        throw new Error("Input contains potentially malicious content");
      }
    }

    // Normalize whitespace
    sanitized = sanitized.trim().replace(/\s+/g, " ");

    return sanitized;
  }

  /**
   * Sanitize hex strings for cryptographic operations
   */
  static sanitizeHexString(
    input: string,
    expectedLength?: number,
    allowEmpty: boolean = false,
  ): string {
    const sanitized = this.sanitizeInput(input, 10000, allowEmpty);

    // Remove non-hex characters
    const hexOnly = sanitized.replace(/[^a-fA-F0-9]/g, "");

    // Allow empty if specified
    if (allowEmpty && hexOnly.length === 0) {
      return "";
    }

    // Validate hex string
    if (hexOnly.length % 2 !== 0) {
      throw new Error("Invalid hex string: odd length");
    }

    if (expectedLength && hexOnly.length !== expectedLength) {
      throw new Error(
        `Invalid hex string length: expected ${expectedLength}, got ${hexOnly.length}`,
      );
    }

    return hexOnly.toLowerCase();
  }

  /**
   * Sanitize numeric strings for amounts and indices
   */
  static sanitizeNumericString(
    input: string,
    maxValue: bigint = BigInt("18446744073709551615"),
  ): string {
    const sanitized = this.sanitizeInput(input, 10000, true); // Allow empty for processing

    // Remove non-numeric characters
    const numericOnly = sanitized.replace(/[^0-9]/g, "");

    if (!numericOnly || numericOnly === "0".repeat(numericOnly.length)) {
      throw new Error("Invalid numeric string");
    }

    // Check maximum value
    const value = BigInt(numericOnly);
    if (value > maxValue) {
      throw new Error(`Value too large: maximum ${maxValue} allowed`);
    }

    return numericOnly;
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  static safeCompare(a: string, b: string): boolean {
    if (!a || !b || typeof a !== "string" || typeof b !== "string") {
      return false;
    }

    // Normalize lengths to prevent timing attacks
    const maxLength = Math.max(a.length, b.length);
    const paddedA = a.padEnd(maxLength, "\0");
    const paddedB = b.padEnd(maxLength, "\0");

    // Use our pure JavaScript timing-safe comparison
    // Use AirGap-compatible UTF-8 encoding (no TextEncoder dependency)
    const bufferA = Security.stringToUint8Array(paddedA);
    const bufferB = Security.stringToUint8Array(paddedB);
    return this.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Secure random string generation for nonces and tokens (JavascriptEngine compatible)
   */
  static generateSecureToken(length: number = 32): string {
    if (length <= 0 || length > 256) {
      throw new Error("Invalid token length: must be between 1 and 256");
    }

    // Use Web Crypto API instead of Node.js crypto
    const randomBytes = new Uint8Array(length);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash-based integrity check for sensitive data using Web Crypto API
   */
  static async createIntegrityHash(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify data integrity using hash
   */
  static async verifyIntegrity(data: Uint8Array, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.createIntegrityHash(data);
      return this.safeCompare(actualHash, expectedHash);
    } catch {
      return false;
    }
  }

  /**
   * Secure memory wiping for sensitive data (JavascriptEngine compatible)
   */
  static secureWipe(buffer: Uint8Array | Buffer): void {
    if (!buffer || buffer.length === 0) {
      return;
    }

    try {
      // Multiple passes with different patterns for paranoid security
      buffer.fill(0x00); // All zeros
      buffer.fill(0xff); // All ones
      buffer.fill(0xaa); // Alternating bits
      buffer.fill(0x55); // Alternating bits (inverse)
      buffer.fill(0x00); // Final zeros

      // Force garbage collection if available
      if (typeof global !== "undefined" && (global as any).gc) {
        (global as any).gc();
      }
    } catch (error) {
      Logger.warn("Failed to securely wipe memory");
    }
  }

  /**
   * Validate URL for API calls to prevent SSRF attacks
   */
  static validateUrl(url: string): boolean {
    try {
      const sanitizedUrl = this.sanitizeInput(url);
      const urlObj = new URL(sanitizedUrl);

      // Only allow HTTPS
      if (urlObj.protocol !== "https:") {
        return false;
      }

      // Block private/local IP ranges
      const hostname = urlObj.hostname;
      const privatePatterns = [
        /^127\./, // Loopback
        /^10\./, // Private Class A
        /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
        /^192\.168\./, // Private Class C
        /^169\.254\./, // Link-local
        /^localhost$/i, // Localhost
        /^0\./, // This network
      ];

      for (const pattern of privatePatterns) {
        if (pattern.test(hostname)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Pure JavaScript rate limiters by identifier (JavascriptEngine compatible)
   */
  private static rateLimiters = new Map<string, { count: number; resetTime: number; requests: number[] }>();

  /**
   * Pure JavaScript rate limiting with exponential backoff (no external dependencies)
   */
  static checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number,
    exponentialBackoff: boolean = true,
  ): { allowed: boolean; resetTime?: number; backoffMs?: number } {
    const now = Date.now();
    
    // Get or create a limiter instance for this identifier
    let limiterInfo = this.rateLimiters.get(identifier);
    
    if (!limiterInfo || now >= limiterInfo.resetTime) {
      // Reset the counter and time window
      limiterInfo = {
        count: 0,
        resetTime: now + windowMs,
        requests: []
      };
      this.rateLimiters.set(identifier, limiterInfo);
    }

    // Clean old requests from sliding window
    limiterInfo.requests = limiterInfo.requests.filter(requestTime => 
      now - requestTime < windowMs
    );

    // Check if limit exceeded
    if (limiterInfo.requests.length >= maxRequests) {
      let backoffMs = 0;
      
      if (exponentialBackoff) {
        // Exponential backoff: 2^excess * 1000ms, max 30 minutes
        const excess = limiterInfo.requests.length - maxRequests + 1;
        backoffMs = Math.min(Math.pow(2, excess) * 1000, 30 * 60 * 1000);
        limiterInfo.resetTime = Math.max(limiterInfo.resetTime, now + backoffMs);
      }

      return {
        allowed: false,
        resetTime: limiterInfo.resetTime,
        backoffMs: exponentialBackoff ? backoffMs : undefined,
      };
    }

    // Record this request
    limiterInfo.requests.push(now);
    limiterInfo.count++;

    return { allowed: true };
  }

  /**
   * Clear rate limiting state for an identifier
   */
  static clearRateLimit(identifier: string): void {
    this.rateLimiters.delete(identifier);
  }

  /**
   * Clear all rate limiting state
   */
  static clearAllRateLimits(): void {
    this.rateLimiters.clear();
  }

  /**
   * Clean up all rate limit state for testing purposes
   */
  public static cleanupRateLimitState(): void {
    this.rateLimiters.clear();
  }

  /**
   * Create secure headers for API requests
   */
  static createSecureHeaders(userAgent?: string): Record<string, string> {
    return {
      "User-Agent": userAgent || "AirGap-Cardano-Module/2.0.0",
      Accept: "application/json",
      "Cache-Control": "no-cache",
      "X-Requested-With": "AirGap-Cardano",
      "Accept-Encoding": "gzip, deflate",
      // Security headers
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
    };
  }

  /**
   * Validate and sanitize error messages to prevent information leakage
   */
  static sanitizeErrorMessage(error: Error | string, context?: string): string {
    const errorMsg = typeof error === "string" ? error : error.message;

    // Remove potentially sensitive information
    let sanitized = errorMsg
      .replace(/\b[a-fA-F0-9]{8,}\b/g, "[REDACTED_HASH]") // Hash-like strings (8+ chars)
      .replace(/\baddr[_\w]*1[a-z0-9]+/gi, "[REDACTED_ADDRESS]") // Addresses
      .replace(/\bstake[_\w]*1[a-z0-9]+/gi, "[REDACTED_STAKE_ADDRESS]") // Stake addresses
      .replace(/\b\d+\.\d+\.\d+\.\d+/g, "[REDACTED_IP]") // IP addresses
      .replace(/\bfile:\/\/[^\s]+/g, "[REDACTED_PATH]") // File paths
      .replace(/\b[A-Za-z]:\\[^\s]+/g, "[REDACTED_PATH]") // Windows paths
      .replace(/\/[^\s]*\/[^\s]*/g, "[REDACTED_PATH]"); // Unix paths

    // Limit message length
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 197) + "...";
    }

    // Add context if provided
    if (context) {
      sanitized = `[${context}] ${sanitized}`;
    }

    return sanitized;
  }


  /**
   * Timing-safe equality comparison for buffers (pure JavaScript implementation)
   */
  static timingSafeEqual(a: Uint8Array | Buffer, b: Uint8Array | Buffer): boolean {
    try {
      if (a.length !== b.length) {
        return false;
      }

      let result = 0;
      for (let i = 0; i < a.length; i++) {
        result |= a[i] ^ b[i];
      }

      return result === 0;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize and validate Cardano addresses
   */
  static sanitizeAddress(address: string): string {
    const sanitized = this.sanitizeInput(address);

    // Basic Cardano address validation
    if (!sanitized.startsWith("addr") && !sanitized.startsWith("stake")) {
      throw new Error("Invalid Cardano address format");
    }

    // Remove any non-alphanumeric characters except underscores
    const cleaned = sanitized.replace(/[^a-zA-Z0-9_]/g, "");

    if (cleaned.length < 10) {
      throw new Error("Address too short");
    }

    return cleaned;
  }

  /**
   * Convert string to Uint8Array without TextEncoder (AirGap compatibility)
   */
  static stringToUint8Array(str: string): Uint8Array {
    // Use simple UTF-8 encoding without TextEncoder for AirGap compatibility
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        // Surrogate pair
        i++;
        const hi = code;
        const lo = str.charCodeAt(i);
        const codePoint = 0x10000 + (((hi & 0x3ff) << 10) | (lo & 0x3ff));
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }
    return new Uint8Array(bytes);
  }
}
