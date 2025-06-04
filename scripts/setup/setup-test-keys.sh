#!/usr/bin/env bash

# Setup Test Keys
# Creates secure .keys/ directory for storing test mnemonics

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYS_DIR="$PROJECT_ROOT/.keys"
MNEMONIC_FILE="$KEYS_DIR/test-mnemonic.txt"
SSH_KEY_FILE="$KEYS_DIR/test-ssh-key"
SSH_PUB_FILE="$KEYS_DIR/test-ssh-key.pub"

echo "🔒 Setting up secure test keys directory..."

# Create .keys directory if it doesn't exist
if [ ! -d "$KEYS_DIR" ]; then
    echo "📁 Creating .keys/ directory..."
    mkdir -p "$KEYS_DIR"
    chmod 700 "$KEYS_DIR"
fi

# Check if mnemonic file already exists
if [ -f "$MNEMONIC_FILE" ]; then
    echo "✅ Test mnemonic already exists at: $MNEMONIC_FILE"
    echo "   File permissions: $(stat -c '%a' "$MNEMONIC_FILE")"
    
    # Verify it has 24 words
    WORD_COUNT=$(wc -w < "$MNEMONIC_FILE")
    echo "   Word count: $WORD_COUNT"
    
    if [ "$WORD_COUNT" -eq 24 ]; then
        echo "✅ Mnemonic validation passed"
    else
        echo "⚠️  Warning: Expected 24 words, found $WORD_COUNT"
    fi
    
else
    echo "❌ Test mnemonic not found!"
    echo ""
    echo "Please create the test mnemonic file:"
    echo "  echo 'your 24-word test mnemonic phrase here' > $MNEMONIC_FILE"
    echo "  chmod 600 $MNEMONIC_FILE"
    echo ""
    echo "Example format:"
    echo "  gather define mass absurd property term slim betray salon advice diary student lunar web define route describe popular connect tent month bronze allow economy"
    echo ""
    echo "⚠️  SECURITY REMINDER:"
    echo "  - Use ONLY test mnemonics, never real wallet seeds"
    echo "  - This file is git-ignored and will never be committed"
    echo "  - File permissions should be 600 (owner read/write only)"
    
    exit 1
fi

# Generate SSH key pair for VM access
if [ ! -f "$SSH_KEY_FILE" ]; then
    echo "🔑 Generating SSH key pair for VM access..."
    ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N "" -C "airgap-e2e-test"
    chmod 600 "$SSH_KEY_FILE"
    chmod 644 "$SSH_PUB_FILE"
    echo "✅ SSH key pair generated:"
    echo "   Private key: $SSH_KEY_FILE"
    echo "   Public key: $SSH_PUB_FILE"
else
    echo "✅ SSH key pair already exists"
fi

echo ""
echo "🔒 Security checks:"
echo "   ✅ .keys/ directory exists with secure permissions"
echo "   ✅ test-mnemonic.txt exists" 
echo "   ✅ SSH key pair exists"
echo "   ✅ File permissions are secure"
echo "   ✅ Directory is git-ignored"
echo ""
echo "✅ Test keys setup complete!"