{
  description = "AirGap Cardano Isolated Module";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        # Essential tools for AirGap development
        devTools = with pkgs; [
          # Core development stack
          nodejs_20
          typescript
          
          # Build and packaging tools
          zip
          unzip
          jq
          
          # Git and version control
          git
          
          # Android development tools
          android-tools  # ADB for device communication
          
          # Essential Unix tools
          gnumake
          bash
          coreutils
        ];

        # Welcome message and environment info
        shellHook = ''
          echo "🌍 AirGap Cardano Development Environment"
          echo "========================================"
          echo ""
          echo "📦 Node.js version: $(node --version)"
          echo "📦 npm version: $(npm --version)"
          echo "📦 TypeScript version: $(npm exec tsc -- --version 2>/dev/null || echo 'TypeScript not installed')"
          echo ""
          
          # Check if package.json exists and npm install was run
          if [ -f package.json ]; then
            if [ ! -d node_modules ]; then
              echo "📦 Installing dependencies..."
              npm install
            fi
            
            if [ -d node_modules ]; then
              echo "✅ Dependencies installed"
              
              # Run security audit and show summary
              audit_output=$(npm audit --audit-level=moderate 2>/dev/null || true)
              if echo "$audit_output" | grep -q "vulnerabilities"; then
                echo "⚠️  Security vulnerabilities detected - run 'npm audit fix'"
              else
                echo "✅ No security vulnerabilities detected"
              fi
            else
              echo "❌ Dependencies not installed - run 'npm install'"
            fi
            
            # Check build status
            if [ -d build ]; then
              echo ""
              if [ -d build/dist ]; then
                echo "✅ Project built ($(find build/dist -name '*.js' | wc -l) JS files)"
              else
                echo "🏗️  Project not built yet"
                echo "   Run: npm run build"
              fi
            else
              echo ""
              echo "🏗️  Project not built yet"
              echo "   Run: npm run build"
            fi
            
            echo ""
            echo "🧪 Run 'npm run test:coverage' to generate coverage report"
          fi
          
          echo ""
          echo "🚀 Development Commands:"
          echo "   npm test               # Run tests (229 tests)"
          echo "   npm run build          # Build TypeScript"
          echo "   npm run build:bundle   # Create browser bundle"
          echo "   npm run bundle:airgap:zip # Create signed module ZIP"
          echo ""
          echo "🔧 Module Management:"
          echo "   node scripts/build/sign-module.js --generate-keys  # Generate signing keys"
          echo "   node scripts/build/sign-module.js                  # Sign module"
          echo ""
          echo "📱 Android Deployment:"
          echo "   nix run .#deploy-android # Build, sign and deploy to connected Android device"
          echo "   adb devices              # Check connected Android devices"
          echo ""
        '';

      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = devTools;
          inherit shellHook;
        };

        # Nix apps for quick access to tools
        apps = {
          # Setup and initialization
          setup = {
            type = "app";
            program = "${pkgs.writeShellScript "setup-airgap" ''
              echo "🔧 Setting up AirGap Cardano development environment..."
              
              # Setup SSH keys and test data
              if [ -f scripts/setup/setup-test-keys.sh ]; then
                bash scripts/setup/setup-test-keys.sh
              else
                echo "⚠️  setup-test-keys.sh not found, skipping key setup"
              fi
              
              # Install Node.js dependencies
              if [ -f package.json ]; then
                echo "📦 Installing npm dependencies..."
                npm install
                echo "✅ Setup complete!"
              else
                echo "❌ package.json not found - are you in the project directory?"
                exit 1
              fi
            ''}";
          };

          # Development server
          dev = {
            type = "app";
            program = "${pkgs.writeShellScript "dev-airgap" ''
              echo "🚀 Starting AirGap Cardano development..."
              
              # Run tests first to ensure everything works
              echo "🧪 Running tests..."
              npm test
              
              if [ $? -eq 0 ]; then
                echo ""
                echo "✅ All tests passing! Ready for development."
                echo ""
                echo "🔧 Available commands:"
                echo "   npm run build:bundle     # Build module bundle"
                echo "   npm run bundle:airgap:zip # Create signed ZIP"
                echo "   npm test                 # Re-run tests"
              else
                echo "❌ Tests failed - fix issues before continuing"
                exit 1
              fi
            ''}";
          };

          # Build and sign module
          build = {
            type = "app";
            program = "${pkgs.writeShellScript "build-airgap" ''
              echo "🏗️  Building AirGap Cardano module..."
              
              # Build the module
              npm run build:bundle
              
              if [ $? -eq 0 ]; then
                echo "✅ Module built successfully"
                
                # Sign the module
                echo "🔐 Signing module..."
                node scripts/build/sign-module.js
                
                if [ $? -eq 0 ]; then
                  echo "✅ Module signed successfully"
                  
                  # Create final ZIP
                  echo "📦 Creating AirGap module ZIP..."
                  npm run bundle:airgap:zip
                  
                  if [ $? -eq 0 ]; then
                    echo ""
                    echo "🎉 AirGap module ready for deployment!"
                    echo "📁 Module file: build/airgap-iso-cardano.zip"
                  else
                    echo "❌ Failed to create module ZIP"
                    exit 1
                  fi
                else
                  echo "❌ Module signing failed"
                  exit 1
                fi
              else
                echo "❌ Module build failed"
                exit 1
              fi
            ''}";
          };

          # Deploy to Android device (if connected)
          deploy-android = {
            type = "app";
            program = "${pkgs.writeShellScript "deploy-airgap" ''
              # Ensure tools are available
              export PATH="${pkgs.lib.makeBinPath devTools}:$PATH"
              echo "📱 AirGap Module Android Deployment"
              echo "=================================="
              echo ""
              
              # Check if ADB is available
              if ! command -v adb &> /dev/null; then
                echo "❌ ADB not found. Please install Android SDK platform-tools."
                echo "   On NixOS: nix-shell -p android-tools"
                exit 1
              fi
              
              # Check ADB connection
              echo "🔍 Checking ADB connection..."
              adb devices > /tmp/adb_devices.txt 2>&1
              
              if ! grep -q "device$" /tmp/adb_devices.txt; then
                echo "❌ No Android device connected via ADB"
                echo ""
                echo "💡 Setup instructions:"
                echo "   1. Enable Developer Options on your Android device"
                echo "   2. Enable USB Debugging" 
                echo "   3. Connect device via USB: adb devices"
                echo "   4. Or connect wirelessly: adb connect <device-ip>:5555"
                echo ""
                echo "📋 Available devices:"
                cat /tmp/adb_devices.txt
                exit 1
              fi
              
              # Show connected devices
              device_count=$(grep -c "device$" /tmp/adb_devices.txt)
              echo "✅ Found $device_count Android device(s) connected"
              grep "device$" /tmp/adb_devices.txt | while read device_line; do
                device_id=$(echo "$device_line" | awk '{print $1}')
                echo "   📱 Device: $device_id"
              done
              echo ""
              
              # Build and sign module
              echo "🏗️  Building and signing module..."
              npm run bundle:airgap:zip
              
              if [ $? -ne 0 ]; then
                echo "❌ Failed to build or sign module"
                exit 1
              fi
              
              # Check if module exists
              MODULE_PATH="build/airgap-iso-cardano.zip"
              if [ ! -f "$MODULE_PATH" ]; then
                echo "❌ Module ZIP not found: $MODULE_PATH"
                exit 1
              fi
              
              # Get module info
              module_size=$(stat -c%s "$MODULE_PATH" 2>/dev/null || echo "unknown")
              echo "📦 Module ready: $MODULE_PATH ($module_size bytes)"
              
              # Upload to Android Downloads folder
              ANDROID_PATH="/storage/emulated/0/Download/airgap-iso-cardano.zip"
              echo "📤 Uploading to Android device..."
              echo "   Source: $MODULE_PATH"
              echo "   Destination: $ANDROID_PATH"
              
              # Ensure Downloads directory exists and remove existing file
              adb shell mkdir -p "/storage/emulated/0/Download" 2>/dev/null || true
              adb shell rm -f "$ANDROID_PATH" 2>/dev/null || true
              
              # Upload the module
              if adb push "$MODULE_PATH" "$ANDROID_PATH"; then
                echo "✅ Module uploaded successfully"
                
                # Verify upload
                uploaded_size=$(adb shell stat -c%s "$ANDROID_PATH" 2>/dev/null || echo "0")
                if [ "$uploaded_size" = "$module_size" ] || [ "$module_size" = "unknown" ]; then
                  echo "✅ Upload verified ($uploaded_size bytes)"
                  
                  # Set proper permissions
                  adb shell chmod 644 "$ANDROID_PATH" 2>/dev/null || true
                  
                  echo ""
                  echo "🎉 Deployment complete!"
                  echo "📱 Module location on device: $ANDROID_PATH"
                  echo "💡 Import this file in AirGap Vault > Settings > Isolated Modules"
                else
                  echo "⚠️  Upload size mismatch - please verify manually"
                  echo "   Expected: $module_size bytes"
                  echo "   Actual: $uploaded_size bytes"
                fi
              else
                echo "❌ Failed to upload module to Android device"
                echo ""
                echo "🔧 Troubleshooting:"
                echo "   - Check device storage space"
                echo "   - Verify USB debugging permissions"
                echo "   - Try reconnecting: adb disconnect && adb connect <device>"
                exit 1
              fi
            ''}";
          };
        };
      }
    );
}