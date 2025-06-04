#!/usr/bin/env node

/**
 * Test script to validate AIRGAP_KEYPAIR secret format
 * Updated to work with @stablelib/ed25519 and JSON keypair format
 */

console.log('🔍 Testing AIRGAP_KEYPAIR secret format (new @stablelib/ed25519 format)...');

let keypairData = process.env.AIRGAP_KEYPAIR;

if (!keypairData) {
  console.log('❌ AIRGAP_KEYPAIR environment variable not found');
  console.log('💡 This means either:');
  console.log('   1. The repository secret is not set');
  console.log('   2. The secret name is incorrect (must be exactly "AIRGAP_KEYPAIR")');
  console.log('   3. The workflow is not passing the secret to this step');
  console.log('');
  console.log('📋 To set the secret:');
  console.log('   1. Generate keypair: node scripts/build/sign-module.js --generate-keys');
  console.log('   2. Copy keypair.json content');
  console.log('   3. Set as AIRGAP_KEYPAIR repository secret');
  process.exit(1);
}

console.log('✅ AIRGAP_KEYPAIR found');
console.log('📏 Length:', keypairData.length, 'characters');

// Parse JSON keypair
let keypair;
try {
  keypair = JSON.parse(keypairData);
  console.log('✅ Successfully parsed JSON keypair');
} catch (error) {
  console.log('❌ Failed to parse JSON keypair:', error.message);
  console.log('💡 Expected format: {"publicKey": [array], "secretKey": [array]}');
  process.exit(1);
}

// Validate keypair structure
if (!keypair.publicKey || !Array.isArray(keypair.publicKey)) {
  console.log('❌ Missing or invalid publicKey array');
  process.exit(1);
}

if (!keypair.secretKey || !Array.isArray(keypair.secretKey)) {
  console.log('❌ Missing or invalid secretKey array');
  process.exit(1);
}

console.log('✅ Keypair has valid structure');
console.log('📏 Public key length:', keypair.publicKey.length, 'bytes');
console.log('📏 Secret key length:', keypair.secretKey.length, 'bytes');

// Validate key lengths for Ed25519
if (keypair.publicKey.length !== 32) {
  console.log('❌ Invalid public key length (expected 32 bytes for Ed25519)');
  process.exit(1);
}

if (keypair.secretKey.length !== 64) {
  console.log('❌ Invalid secret key length (expected 64 bytes for Ed25519)');
  process.exit(1);
}

console.log('✅ Key lengths are correct for Ed25519');

// Test with @stablelib/ed25519
console.log('🔐 Testing keypair with @stablelib/ed25519...');
try {
  const { sign, verify } = require('@stablelib/ed25519');
  
  // Convert arrays back to Uint8Array
  const publicKey = new Uint8Array(keypair.publicKey);
  const secretKey = new Uint8Array(keypair.secretKey);
  
  // Test message
  const testMessage = Buffer.from('AirGap test message', 'utf8');
  
  // Sign test message
  const signature = sign(secretKey, testMessage);
  console.log('✅ Successfully signed test message');
  console.log('📝 Signature length:', signature.length, 'bytes');
  
  // Verify signature
  const isValid = verify(publicKey, testMessage, signature);
  if (isValid) {
    console.log('✅ Signature verification successful');
  } else {
    console.log('❌ Signature verification failed');
    process.exit(1);
  }
  
  // Derive public key hex for comparison
  const publicKeyHex = '0x' + Buffer.from(publicKey).toString('hex');
  console.log('🔑 Public key (hex):', publicKeyHex);
  
  // Check if it matches manifest
  const fs = require('fs');
  const path = require('path');
  const manifestPath = path.join(__dirname, '..', '..', 'build', 'manifest.json');
  
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.publicKey === publicKeyHex) {
      console.log('✅ Public key matches manifest.json');
    } else {
      console.log('❌ Public key mismatch!');
      console.log('   Manifest:', manifest.publicKey);
      console.log('   Derived: ', publicKeyHex);
    }
  } else {
    console.log('⚠️ manifest.json not found at:', manifestPath);
    console.log('💡 Run build first to create manifest');
  }
  
} catch (error) {
  console.log('❌ Keypair testing failed:', error.message);
  console.log('💡 Make sure @stablelib/ed25519 is installed: npm install @stablelib/ed25519');
  process.exit(1);
}

console.log('🎉 All tests passed! The keypair should work for signing with @stablelib/ed25519.');
console.log('');
console.log('📋 Next steps:');
console.log('   1. Set AIRGAP_KEYPAIR as repository secret');
console.log('   2. CI will use this keypair for automated signing');
console.log('   3. Modules will be signed with the same key consistently');