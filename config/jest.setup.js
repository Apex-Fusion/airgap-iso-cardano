// Jest setup for crypto libraries and test environment
process.env.NODE_ENV = 'test';

// Add BigInt serialization support for Jest
BigInt.prototype.toJSON = function() {
  return this.toString();
};

// Suppress expected error logs during testing to keep output clean
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0];
  
  // Suppress expected test error patterns
  if (typeof message === 'string') {
    const suppressedPatterns = [
      '[ERROR] UTXO selection failed',
      '[ERROR] Transaction build failed',
      '[ERROR] Failed to fetch delegation info',
      '[ERROR] Failed to fetch staking activity', 
      '[ERROR] Failed to build portfolio',
      'UTXOSelectionError',
      'ValidationError',
      'Address not found',
      'API error: 404',
      'API error: 403'
    ];
    
    if (suppressedPatterns.some(pattern => message.includes(pattern))) {
      return; // Suppress expected test errors
    }
  }
  
  // Log all other errors normally
  originalConsoleError.apply(console, args);
};

// Ensure bip39 is available for test mocks
try {
  require('bip39');
} catch (error) {
  console.warn('Warning: bip39 not available in test environment');
}

// Ensure crypto module is available
try {
  require('crypto');
} catch (error) {
  console.warn('Warning: crypto module not available in test environment');
}