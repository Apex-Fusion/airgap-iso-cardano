/**
 * Test Setup and Environment Configuration
 * 
 * This file ensures proper test environment setup for Cardano protocol testing.
 * It includes polyfill installation, module initialization, and environment validation.
 */

import { installTextEncoderPolyfill } from '../../src/utils/text-encoder-polyfill';

// Install polyfill before any other imports to ensure compatibility
installTextEncoderPolyfill();

// Global test configuration
beforeAll(async () => {
  // Ensure TextEncoder/TextDecoder are available for TyphonJS
  if (typeof globalThis.TextEncoder === 'undefined' || typeof globalThis.TextDecoder === 'undefined') {
    throw new Error('TextEncoder/TextDecoder polyfill failed to install');
  }
  
  // Suppress console warnings during tests
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  // Restore console methods
  jest.restoreAllMocks();
});

// Test environment validation
describe('Test Environment Setup', () => {
  it('should have TextEncoder/TextDecoder available', () => {
    expect(typeof globalThis.TextEncoder).toBe('function');
    expect(typeof globalThis.TextDecoder).toBe('function');
  });

  it('should be able to encode/decode text', () => {
    const encoder = new globalThis.TextEncoder();
    const decoder = new globalThis.TextDecoder();
    
    const text = 'Hello Cardano!';
    const encoded = encoder.encode(text);
    const decoded = decoder.decode(encoded);
    
    expect(decoded).toBe(text);
  });

  it('should have required test dependencies', () => {
    expect(typeof jest).toBe('object');
    expect(typeof describe).toBe('function');
    expect(typeof it).toBe('function');
    expect(typeof expect).toBe('function');
  });
});