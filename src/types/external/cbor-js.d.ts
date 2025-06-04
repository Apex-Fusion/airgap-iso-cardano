/**
 * Type declarations for cbor-js
 * Pure JavaScript CBOR implementation by Patrick Gansterer (@paroga)
 */

declare module 'cbor-js' {
  /**
   * Encode a JavaScript value to CBOR format
   * @param value - The value to encode (objects, arrays, numbers, strings, etc.)
   * @returns ArrayBuffer containing the CBOR-encoded data
   */
  export function encode(value: any): ArrayBuffer;

  /**
   * Decode CBOR data back to JavaScript value
   * @param data - ArrayBuffer containing CBOR-encoded data
   * @param tagger - Optional function to handle tagged values
   * @param simpleValue - Optional function to handle simple values
   * @returns The decoded JavaScript value
   */
  export function decode(
    data: ArrayBuffer, 
    tagger?: (value: any, tag: number) => any,
    simpleValue?: (value: number) => any
  ): any;
}