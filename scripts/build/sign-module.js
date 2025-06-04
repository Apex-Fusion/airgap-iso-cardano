#!/usr/bin/env node

const { sign, generateKeyPair } = require('@stablelib/ed25519');
const fs = require('fs');
const path = require('path');

/**
 * AirGap Module Signing Utility (Official Pattern)
 * 
 * Uses @stablelib/ed25519 to match official AirGap Bitcoin module implementation.
 * This script follows the exact pattern from airgap-community/examples/isolated-modules/bitcoin
 */

class ModuleSigner {
  constructor() {
    this.keypairPath = path.join(__dirname, '..', '..', 'keypair.json');
  }

  /**
   * Generate a new Ed25519 key pair using @stablelib/ed25519
   * Matches the official AirGap pattern exactly
   */
  generateKeyPair() {
    console.log('🔑 Generating Ed25519 key pair using @stablelib/ed25519...');

    // Generate keypair using @stablelib/ed25519 (official AirGap pattern)
    const keypair = generateKeyPair();
    
    // Convert to hex strings for JSON storage (matching Bitcoin example)
    const keypairData = {
      publicKey: Array.from(keypair.publicKey),
      secretKey: Array.from(keypair.secretKey)
    };
    
    // Save to keypair.json (matching official pattern)
    fs.writeFileSync(this.keypairPath, JSON.stringify(keypairData, null, 2));
    
    const publicKeyHex = '0x' + Buffer.from(keypair.publicKey).toString('hex');
    
    console.log('✅ Key pair generated successfully!');
    console.log('📁 Keypair saved to:', this.keypairPath);
    console.log('🔑 Public key (hex):', publicKeyHex);
    console.log('💡 Using @stablelib/ed25519 for maximum compatibility');
    
    return {
      publicKey: keypair.publicKey,
      secretKey: keypair.secretKey,
      publicKeyHex
    };
  }


  /**
   * Load existing key pair using official AirGap pattern
   */
  loadKeyPair() {
    let keypairData;

    // Try to load from environment variables first (for CI/CD)
    if (process.env.AIRGAP_KEYPAIR) {
      console.log('🔑 Loading keypair from environment variable');
      try {
        keypairData = JSON.parse(process.env.AIRGAP_KEYPAIR);
      } catch (error) {
        throw new Error('Failed to parse AIRGAP_KEYPAIR environment variable: ' + error.message);
      }
    } else {
      // Load from keypair.json file (matching Bitcoin example)
      if (!fs.existsSync(this.keypairPath)) {
        throw new Error('Keypair not found. Run with --generate-keys first or set AIRGAP_KEYPAIR environment variable.');
      }

      console.log('🔑 Loading keypair from local file');
      keypairData = JSON.parse(fs.readFileSync(this.keypairPath, 'utf8'));
    }
    
    // Convert from array format back to Uint8Array
    const publicKey = new Uint8Array(keypairData.publicKey);
    const secretKey = new Uint8Array(keypairData.secretKey);
    const publicKeyHex = '0x' + Buffer.from(publicKey).toString('hex');

    return {
      publicKey,
      secretKey,
      publicKeyHex
    };
  }

  /**
   * Sign AirGap module using official algorithm from Bitcoin example
   * 
   * This follows the exact pattern from airgap-community/examples/isolated-modules/bitcoin/scripts/sign-module.js
   */
  signAirGapModule(moduleDir, keypair) {
    console.log('📝 Signing AirGap module using official algorithm:', moduleDir);
    
    const manifestPath = path.join(moduleDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}`);
    }

    // Read and parse manifest to get included files (official pattern)
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const includedFiles = manifest.include || [];
    
    console.log('📋 Included files from manifest:', includedFiles);
    
    // Concatenate all included files (official AirGap algorithm)
    let bytes = Buffer.alloc(0);
    for (const fileName of includedFiles) {
      const filePath = path.join(moduleDir, fileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Included file not found: ${filePath}`);
      }
      const fileContent = fs.readFileSync(filePath);
      bytes = Buffer.concat([bytes, fileContent]);
      console.log(`📄 Read file: ${fileName} (${fileContent.length} bytes)`);
    }
    
    // Add manifest as last file (official AirGap algorithm)
    const manifestContent = fs.readFileSync(manifestPath);
    bytes = Buffer.concat([bytes, manifestContent]);
    console.log(`📄 Read manifest: manifest.json (${manifestContent.length} bytes)`);
    console.log(`📐 Total message length: ${bytes.length} bytes`);
    
    // Sign using @stablelib/ed25519 (official pattern)
    const signature = sign(keypair.secretKey, bytes);
    const signatureHex = Buffer.from(signature).toString('hex');
    
    console.log('✅ AirGap module signed successfully using @stablelib/ed25519!');
    console.log('📝 Signature length:', signature.length, 'bytes');
    
    return {
      signature: signatureHex,
      signatureBytes: signature,
      messageLength: bytes.length,
      includedFiles
    };
  }

  /**
   * Verify AirGap module signature using @stablelib/ed25519
   */
  verifyAirGapModule(moduleDir, signatureHex, publicKey) {
    console.log('🔍 Verifying AirGap module signature using @stablelib/ed25519:', moduleDir);
    
    const manifestPath = path.join(moduleDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const includedFiles = manifest.include || [];
    
    // Recreate the same concatenated message (official algorithm)
    let bytes = Buffer.alloc(0);
    for (const fileName of includedFiles) {
      const filePath = path.join(moduleDir, fileName);
      const fileContent = fs.readFileSync(filePath);
      bytes = Buffer.concat([bytes, fileContent]);
    }
    
    const manifestContent = fs.readFileSync(manifestPath);
    bytes = Buffer.concat([bytes, manifestContent]);
    
    // Verify signature using @stablelib/ed25519
    const signature = Buffer.from(signatureHex, 'hex');
    try {
      const { verify } = require('@stablelib/ed25519');
      const isValid = verify(publicKey, bytes, signature);
      console.log('✅ AirGap signature verification using @stablelib/ed25519:', isValid ? 'VALID' : 'INVALID');
      return isValid;
    } catch (error) {
      console.log('❌ AirGap signature verification failed:', error.message);
      return false;
    }
  }

  /**
   * Sign an AirGap module following official pattern
   */
  signModule(modulePathOrDir, outputDir = null) {
    let moduleDir;
    
    // Determine if we got a file path or directory
    if (fs.existsSync(modulePathOrDir) && fs.statSync(modulePathOrDir).isDirectory()) {
      moduleDir = modulePathOrDir;
    } else {
      // Got a module file path - create proper bundle structure
      const moduleFile = modulePathOrDir;
      const projectRoot = path.join(__dirname, '..', '..');
      const buildDir = path.dirname(moduleFile);
      
      // Create temp-module directory with proper AirGap structure  
      const tempModuleDir = path.join(buildDir, 'temp-module');
      if (!fs.existsSync(tempModuleDir)) {
        fs.mkdirSync(tempModuleDir, { recursive: true });
      }
      
      // Copy module file to temp directory with standardized name
      const moduleFileName = 'airgap-iso-cardano.js';
      const tempModuleFile = path.join(tempModuleDir, moduleFileName);
      fs.copyFileSync(moduleFile, tempModuleFile);
      
      // Copy or create manifest
      const sourceManifest = path.join(buildDir, 'manifest.json');
      const tempManifest = path.join(tempModuleDir, 'manifest.json');
      if (fs.existsSync(sourceManifest)) {
        fs.copyFileSync(sourceManifest, tempManifest);
      } else {
        // Create basic manifest following official pattern
        const includeFiles = [moduleFileName];
        
        // Auto-detect and include assets
        const assetsDir = path.join(projectRoot, 'assets');
        if (fs.existsSync(assetsDir)) {
          const assetFiles = fs.readdirSync(assetsDir).filter(file => 
            file.endsWith('.svg') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
          );
          includeFiles.push(...assetFiles);
          if (assetFiles.length > 0) {
            console.log(`📄 Auto-detected ${assetFiles.length} asset file(s): ${assetFiles.join(', ')}`);
            
            // Copy asset files to module directory
            for (const assetFile of assetFiles) {
              const sourceAsset = path.join(assetsDir, assetFile);
              const tempAsset = path.join(tempModuleDir, assetFile);
              fs.copyFileSync(sourceAsset, tempAsset);
              console.log(`📄 Copied asset: ${assetFile}`);
            }
          }
        }
        
        const basicManifest = {
          "name": "airgap-iso-cardano",
          "identifier": "cardano",
          "version": "1.0.0",
          "author": "AirGap Contributors",
          "description": "AirGap Cardano isolated module for secure offline transaction signing",
          "src": {
            "namespace": "cardano"
          },
          "res": {
            "symbol": {
              "cardano": "file://cardano.svg",
              "ada": "file://cardano.svg"
            }
          },
          "include": includeFiles,
          "jsenv": {
            "ios": "webview",
            "android": "webview"
          }
        };
        fs.writeFileSync(tempManifest, JSON.stringify(basicManifest, null, 2));
        console.log('📄 Created basic manifest.json');
      }
      
      moduleDir = tempModuleDir;
      console.log(`📁 Created temp-module directory: ${moduleDir}`);
    }
    
    const signatureFile = path.join(moduleDir, 'module.sig');
    
    try {
      // Load or generate key pair
      let keypair;
      try {
        keypair = this.loadKeyPair();
        console.log('🔑 Using existing key pair');
      } catch (error) {
        console.log('🔑 No existing key pair found, generating new one...');
        keypair = this.generateKeyPair();
      }

      // Update manifest with public key
      const manifestPath = path.join(moduleDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifest.publicKey = keypair.publicKeyHex;
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('🔑 Added public key to manifest:', keypair.publicKeyHex);

      // Sign using official AirGap algorithm with @stablelib/ed25519
      const result = this.signAirGapModule(moduleDir, keypair);
      
      // Write signature to file as binary (matching Bitcoin example)
      fs.writeFileSync(signatureFile, result.signatureBytes);
      console.log('💾 Signature saved to:', signatureFile, '(binary format)');
      
      // Verify the signature
      const isValid = this.verifyAirGapModule(moduleDir, result.signature, keypair.publicKey);
      
      if (isValid) {
        console.log('🎉 AirGap module signed and verified successfully using @stablelib/ed25519!');
        console.log('');
        console.log('📋 Module details:');
        console.log(`- Included files: ${result.includedFiles.join(', ')}`);
        console.log(`- Message length: ${result.messageLength} bytes`);
        console.log(`- Public key: ${keypair.publicKeyHex}`);
      }
      
      return {
        signature: result.signature,
        publicKeyHex: keypair.publicKeyHex,
        signatureFile,
        messageLength: result.messageLength,
        includedFiles: result.includedFiles
      };
      
    } catch (error) {
      console.error('❌ AirGap module signing failed:', error.message);
      throw error;
    }
  }

  /**
   * Update manifest.json with new public key
   */
  updateManifest(publicKeyHex, manifestPath = null) {
    const manifestFile = manifestPath || path.join(__dirname, '..', '..', 'build', 'manifest.json');
    
    console.log('📝 Updating manifest.json with new public key...');
    
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.publicKey = publicKeyHex;
    
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
    console.log('✅ Manifest updated with public key:', publicKeyHex);
  }
}

// CLI interface
function main() {
  const signer = new ModuleSigner();
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AirGap Module Signing Utility (Official Pattern)
Uses @stablelib/ed25519 to match official AirGap Bitcoin module implementation

Usage:
  node sign-module.js [options] [module-file]

Options:
  --generate-keys     Generate new key pair using @stablelib/ed25519
  --sign <file>       Sign a specific module file
  --verify <file>     Verify signature of a module file
  --update-manifest   Update manifest.json with current public key
  --help, -h         Show this help message

Examples:
  node sign-module.js --generate-keys
  node sign-module.js --sign build/airgap-iso-cardano.js
  node sign-module.js module/airgap-iso-cardano.js
  node sign-module.js --update-manifest
`);
    return;
  }

  try {
    if (args.includes('--generate-keys')) {
      const keypair = signer.generateKeyPair();
      console.log('\n🔧 To use this key pair:');
      console.log('1. Run: node sign-module.js --update-manifest');
      console.log('2. Run: npm run bundle:airgap:zip');
      
    } else if (args.includes('--update-manifest')) {
      const keypair = signer.loadKeyPair();
      signer.updateManifest(keypair.publicKeyHex);
      
    } else if (args.includes('--sign')) {
      const fileIndex = args.indexOf('--sign') + 1;
      if (fileIndex < args.length) {
        const moduleFile = args[fileIndex];
        signer.signModule(moduleFile);
      } else {
        throw new Error('Please specify a file to sign');
      }
      
    } else if (args.length > 0) {
      // Default: sign the specified module file
      const moduleFile = args[0];
      signer.signModule(moduleFile);
      
    } else {
      // Default: complete signing workflow
      console.log('🚀 Starting AirGap module signing using @stablelib/ed25519...\n');
      
      // Generate or load keys
      let keypair;
      try {
        keypair = signer.loadKeyPair();
        console.log('🔑 Using existing key pair\n');
      } catch (error) {
        keypair = signer.generateKeyPair();
        console.log('');
      }
      
      // Update manifest
      signer.updateManifest(keypair.publicKeyHex);
      console.log('');
      
      // Check if module exists and sign it
      const modulePath = path.join(__dirname, '..', '..', 'build', 'airgap-iso-cardano.js');
      if (fs.existsSync(modulePath)) {
        signer.signModule(modulePath);
      } else {
        console.log('⚠️  Module not found at:', modulePath);
        console.log('💡 Run "npm run build:bundle" first to build the module');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ModuleSigner;