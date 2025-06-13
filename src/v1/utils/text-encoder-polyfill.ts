/**
 * Minimal TextEncoder/TextDecoder Polyfill for AirGap's Restrictive Environment
 * 
 * This polyfill provides the minimal functionality needed by @stricahq/typhonjs
 * and @stricahq/cbors libraries. It only implements the specific features used
 * by these libraries to keep the polyfill small and focused.
 * 
 * Key Features:
 * - UTF-8 encoding/decoding only (sufficient for Cardano transaction data)
 * - Automatic installation in global scope when TextEncoder/TextDecoder are missing
 * - Full compatibility with TyphonJS serialization requirements
 * - Zero external dependencies
 */

// Define BufferSource type for compatibility
type BufferSource = ArrayBufferView | ArrayBuffer;

/**
 * Minimal TextDecoder implementation focused on UTF-8 decoding for TyphonJS
 */
export class MinimalTextDecoder {
  private readonly _encoding: string;
  private readonly _fatal: boolean;
  private readonly _ignoreBOM: boolean;

  constructor(encoding: string = 'utf-8', options: { fatal?: boolean; ignoreBOM?: boolean } = {}) {
    // Normalize encoding name (TyphonJS uses 'utf8', but standard is 'utf-8')
    this._encoding = encoding.toLowerCase().replace('utf8', 'utf-8');
    this._fatal = options.fatal || false;
    this._ignoreBOM = options.ignoreBOM || false;

    // Only support UTF-8 for simplicity and security
    if (this._encoding !== 'utf-8') {
      throw new Error(`Unsupported encoding: ${encoding}. Only UTF-8 is supported.`);
    }
  }

  /**
   * Decode UTF-8 bytes to string
   * This is the main method used by @stricahq/cbors
   */
  decode(input?: BufferSource): string {
    if (!input) {
      return '';
    }

    // Convert input to Uint8Array if it's not already
    let bytes: Uint8Array;
    if (input instanceof ArrayBuffer) {
      bytes = new Uint8Array(input);
    } else if (input instanceof Uint8Array) {
      bytes = input;
    } else if (typeof input === 'object' && 'buffer' in input) {
      // Handle Buffer objects (Node.js Buffer)
      bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
      throw new Error('Invalid input type for decode()');
    }

    // Handle BOM if present and not ignored
    let startIndex = 0;
    if (!this._ignoreBOM && bytes.length >= 3) {
      if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
        startIndex = 3; // Skip UTF-8 BOM
      }
    }

    return this.decodeUTF8(bytes, startIndex);
  }

  /**
   * Decode UTF-8 bytes to string with proper error handling
   */
  private decodeUTF8(bytes: Uint8Array, startIndex: number = 0): string {
    const result: string[] = [];
    let i = startIndex;

    while (i < bytes.length) {
      const byte1 = bytes[i];

      if (byte1 < 0x80) {
        // 1-byte character (ASCII)
        result.push(String.fromCharCode(byte1));
        i++;
      } else if ((byte1 & 0xE0) === 0xC0) {
        // 2-byte character
        if (i + 1 >= bytes.length) {
          if (this._fatal) {
            throw new Error('Incomplete UTF-8 sequence');
          }
          result.push('\uFFFD'); // Replacement character
          break;
        }

        const byte2 = bytes[i + 1];
        if ((byte2 & 0xC0) !== 0x80) {
          if (this._fatal) {
            throw new Error('Invalid UTF-8 sequence');
          }
          result.push('\uFFFD');
          i++;
          continue;
        }

        const codePoint = ((byte1 & 0x1F) << 6) | (byte2 & 0x3F);
        if (codePoint < 0x80) {
          if (this._fatal) {
            throw new Error('Overlong UTF-8 sequence');
          }
          result.push('\uFFFD');
        } else {
          result.push(String.fromCharCode(codePoint));
        }
        i += 2;
      } else if ((byte1 & 0xF0) === 0xE0) {
        // 3-byte character
        if (i + 2 >= bytes.length) {
          if (this._fatal) {
            throw new Error('Incomplete UTF-8 sequence');
          }
          result.push('\uFFFD');
          break;
        }

        const byte2 = bytes[i + 1];
        const byte3 = bytes[i + 2];
        if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80) {
          if (this._fatal) {
            throw new Error('Invalid UTF-8 sequence');
          }
          result.push('\uFFFD');
          i++;
          continue;
        }

        const codePoint = ((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F);
        if (codePoint < 0x800 || (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
          if (this._fatal) {
            throw new Error('Invalid UTF-8 codepoint');
          }
          result.push('\uFFFD');
        } else {
          result.push(String.fromCharCode(codePoint));
        }
        i += 3;
      } else if ((byte1 & 0xF8) === 0xF0) {
        // 4-byte character
        if (i + 3 >= bytes.length) {
          if (this._fatal) {
            throw new Error('Incomplete UTF-8 sequence');
          }
          result.push('\uFFFD');
          break;
        }

        const byte2 = bytes[i + 1];
        const byte3 = bytes[i + 2];
        const byte4 = bytes[i + 3];
        if ((byte2 & 0xC0) !== 0x80 || (byte3 & 0xC0) !== 0x80 || (byte4 & 0xC0) !== 0x80) {
          if (this._fatal) {
            throw new Error('Invalid UTF-8 sequence');
          }
          result.push('\uFFFD');
          i++;
          continue;
        }

        const codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3F) << 12) | ((byte3 & 0x3F) << 6) | (byte4 & 0x3F);
        if (codePoint < 0x10000 || codePoint > 0x10FFFF) {
          if (this._fatal) {
            throw new Error('Invalid UTF-8 codepoint');
          }
          result.push('\uFFFD');
        } else {
          // Convert to surrogate pair for JavaScript strings
          const adjusted = codePoint - 0x10000;
          result.push(String.fromCharCode(0xD800 + (adjusted >> 10)));
          result.push(String.fromCharCode(0xDC00 + (adjusted & 0x3FF)));
        }
        i += 4;
      } else {
        // Invalid start byte
        if (this._fatal) {
          throw new Error('Invalid UTF-8 start byte');
        }
        result.push('\uFFFD');
        i++;
      }
    }

    return result.join('');
  }

  get encoding(): string {
    return this._encoding;
  }

  get fatal(): boolean {
    return this._fatal;
  }

  get ignoreBOM(): boolean {
    return this._ignoreBOM;
  }
}

/**
 * Minimal TextEncoder implementation for completeness
 * (May be needed by other parts of TyphonJS)
 */
export class MinimalTextEncoder {
  constructor() {
    // TextEncoder always uses UTF-8
  }

  /**
   * Encode string to UTF-8 bytes
   */
  encode(input: string = ''): Uint8Array {
    const bytes: number[] = [];
    
    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      
      if (code < 0x80) {
        // 1-byte character (ASCII)
        bytes.push(code);
      } else if (code < 0x800) {
        // 2-byte character
        bytes.push(0xC0 | (code >> 6));
        bytes.push(0x80 | (code & 0x3F));
      } else if (code < 0xD800 || code >= 0xE000) {
        // 3-byte character (not surrogate)
        bytes.push(0xE0 | (code >> 12));
        bytes.push(0x80 | ((code >> 6) & 0x3F));
        bytes.push(0x80 | (code & 0x3F));
      } else {
        // Surrogate pair (4-byte character)
        if (i + 1 >= input.length) {
          throw new Error('Incomplete surrogate pair');
        }
        
        const hi = code;
        const lo = input.charCodeAt(++i);
        
        if (hi >= 0xD800 && hi <= 0xDBFF && lo >= 0xDC00 && lo <= 0xDFFF) {
          const codePoint = 0x10000 + (((hi & 0x3FF) << 10) | (lo & 0x3FF));
          bytes.push(0xF0 | (codePoint >> 18));
          bytes.push(0x80 | ((codePoint >> 12) & 0x3F));
          bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
          bytes.push(0x80 | (codePoint & 0x3F));
        } else {
          throw new Error('Invalid surrogate pair');
        }
      }
    }
    
    return new Uint8Array(bytes);
  }

  get encoding(): string {
    return 'utf-8';
  }
}

/**
 * Install the polyfill in the global scope
 * Call this before importing TyphonJS to ensure compatibility
 */
export function installTextEncoderPolyfill(): void {
  // Only install if not already present (avoid overriding native implementations)
  if (typeof globalThis.TextDecoder === 'undefined') {
    (globalThis as any).TextDecoder = MinimalTextDecoder;
  }
  
  if (typeof globalThis.TextEncoder === 'undefined') {
    (globalThis as any).TextEncoder = MinimalTextEncoder;
  }
}

/**
 * Remove the polyfill from global scope (for testing)
 */
export function uninstallTextEncoderPolyfill(): void {
  delete (globalThis as any).TextDecoder;
  delete (globalThis as any).TextEncoder;
}

/**
 * Check if polyfill is needed (TextDecoder/TextEncoder missing)
 */
export function isPolyfillNeeded(): { needsTextDecoder: boolean; needsTextEncoder: boolean } {
  return {
    needsTextDecoder: typeof globalThis.TextDecoder === 'undefined',
    needsTextEncoder: typeof globalThis.TextEncoder === 'undefined'
  };
}

// Export the polyfill classes as default types to avoid conflicts