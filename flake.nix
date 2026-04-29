{
  description = "AirGap Cardano Isolated Module";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };

        # Android SDK configuration
        androidComposition = pkgs.androidenv.composeAndroidPackages {
          platformVersions = [ "35" "34" "33" "31" "30" "29" "28" ];
          buildToolsVersions = [ "34.0.0" "33.0.0" "30.0.3" ];
          includeEmulator = false;
          includeNDK = false;
          includeSources = false;
          includeSystemImages = false;
        };

        # Essential tools for AirGap development
        devTools = with pkgs; [
          # Core development stack
          nodejs_20
          bun
          yarn
          jdk21  # Java 21 required by airgap-wallet plugins (airgap-vault works with 21 too)

          # Build and packaging tools
          zip
          unzip
          jq

          # Git and version control
          git

          # Android development tools
          android-tools  # ADB for device communication
          androidComposition.androidsdk

          # Essential Unix tools
          gnumake
          bash
          coreutils
          curl
        ];

        # Verdaccio configuration for local npm registry
        verdaccioConfig = pkgs.writeText "verdaccio-config.yaml" ''
          storage: ./.verdaccio/storage
          plugins: ./.verdaccio/plugins

          web:
            enable: true
            title: AirGap Local Registry

          auth:
            htpasswd:
              file: ./.verdaccio/htpasswd
              max_users: -1

          uplinks:
            npmjs:
              url: https://registry.npmjs.org/

          packages:
            '@apex-fusion/*':
              access: $all
              publish: $all
              unpublish: $all

            '@airgap/*':
              access: $all
              proxy: npmjs

            '**':
              access: $all
              proxy: npmjs

          server:
            keepAliveTimeout: 60

          middlewares:
            audit:
              enabled: true

          listen: 0.0.0.0:4873

          logs:
            type: stdout
            format: pretty
            level: info
        '';

        # Welcome message and environment info
        shellHook = ''
          # Set Java environment variables
          export JAVA_HOME="${pkgs.jdk21}"

          # Set Android SDK environment variables
          export ANDROID_HOME="${androidComposition.androidsdk}/libexec/android-sdk"
          export ANDROID_SDK_ROOT="$ANDROID_HOME"
          export PATH="$ANDROID_HOME/build-tools/34.0.0:$ANDROID_HOME/build-tools/33.0.0:$ANDROID_HOME/build-tools/30.0.3:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin:$ANDROID_HOME/platform-tools:$PATH"

          echo "🌍 AirGap Cardano Development Environment"
          echo "========================================"
          echo ""
          echo "[DEBUG] Checking Node.js version..."
          echo "📦 Node.js version: $(node --version)"
          echo "[DEBUG] Checking npm version..."
          echo "📦 npm version: $(npm --version)"
          echo "[DEBUG] Version checks complete"
          echo "☕ Java: $(java -version 2>&1 | head -n 1)"
          echo "🤖 Android SDK: $ANDROID_SDK_ROOT"
          echo ""

          # Check if package.json exists and npm install was run
          echo "[DEBUG] Checking package.json..."
          if [ -f package.json ]; then
            echo "[DEBUG] package.json found, checking node_modules..."
            echo "[DEBUG] Checking if dependencies installed..."
            if [ -d node_modules ]; then
              echo "✅ Dependencies installed"
            else
              echo "❌ Dependencies not installed - run 'bun install'"
            fi

            # Check build status
            echo "[DEBUG] Checking build status..."
            if [ -d build ]; then
              echo ""
              if [ -d build/dist ]; then
                echo "[DEBUG] Counting JS files..."
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
          echo "[DEBUG] Shell hook complete"
          
          echo ""
          echo "🚀 Development Commands:"
          echo "   bun install            # Install dependencies"
          echo "   bun run test           # Run tests (229 tests)"
          echo "   bun run build          # Build TypeScript"
          echo "   bun run build:bundle   # Create browser bundle"
          echo "   bun run bundle:airgap:zip # Create signed module ZIP"
          echo ""
          echo "🔧 Module Management:"
          echo "   node scripts/build/sign-module.js --generate-keys  # Generate signing keys"
          echo "   node scripts/build/sign-module.js                  # Sign module"
          echo ""
          echo "📱 Android Deployment:"
          echo "   === airgap-vault (Isolated Module) ==="
          echo "   nix run .#deploy-android # Build, sign and deploy to connected Android device"
          echo ""
          echo "   === airgap-wallet (Capacitor App) ==="
          echo "   Note: airgap-wallet requires manual Capacitor workflow:"
          echo "   1. bun install          # Install dependencies"
          echo "   2. bun run build:prod   # Build web assets"
          echo "   3. npx cap sync android # Sync web assets to Android project"
          echo "   4. npx cap run android  # Build APK and deploy to device"
          echo ""
          echo "   === Common Android Tools ==="
          echo "   adb devices              # Check connected Android devices"
          echo "   adb kill-server && adb start-server # Restart ADB server if connection issues"
          echo ""
        '';

        # FHS environment for Android development (fixes AAPT2 issues on NixOS)
        fhs = pkgs.buildFHSEnv {
          name = "airgap-android-env";
          targetPkgs = pkgs: devTools ++ (with pkgs; [
            # Additional libraries needed for Android tools
            zlib
            ncurses5
            stdenv.cc.cc.lib
            libglvnd
          ]);
          multiPkgs = pkgs: with pkgs; [
            # 32-bit libraries for Android tools
            zlib
            ncurses5
          ];
          runScript = "bash";
          profile = shellHook;
        };

      in
      {
        devShells.default = fhs.env;

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

          # Start local npm registry and publish package
          serve-local = {
            type = "app";
            program = "${pkgs.writeShellScript "serve-local" ''
              set -e
              export PATH="${pkgs.lib.makeBinPath devTools}:$PATH"
              export HOME="$PWD/.home"
              mkdir -p "$HOME"

              echo "🚀 AirGap Local NPM Registry"
              echo "============================"
              echo ""

              # Create verdaccio directories
              mkdir -p .verdaccio/storage .verdaccio/plugins

              # Copy config (force overwrite)
              cat ${verdaccioConfig} > .verdaccio/config.yaml

              # Create htpasswd file if not exists
              if [ ! -f .verdaccio/htpasswd ]; then
                touch .verdaccio/htpasswd
              fi

              # Check if verdaccio is already running
              if curl -s http://localhost:4873 > /dev/null 2>&1; then
                echo "✅ Verdaccio already running on port 4873"
              else
                echo "🔄 Starting Verdaccio on port 4873..."
                npx verdaccio --config .verdaccio/config.yaml &
                VERDACCIO_PID=$!

                # Wait for verdaccio to start
                for i in {1..30}; do
                  if curl -s http://localhost:4873 > /dev/null 2>&1; then
                    echo "✅ Verdaccio started (PID: $VERDACCIO_PID)"
                    break
                  fi
                  sleep 1
                done

                if ! curl -s http://localhost:4873 > /dev/null 2>&1; then
                  echo "❌ Failed to start Verdaccio"
                  exit 1
                fi
              fi

              echo ""
              echo "📦 Building @apex-fusion/cardano package..."

              # Install dependencies if needed
              if [ ! -d node_modules ]; then
                npm install
              fi

              # Build the npm package (creates npm-package directory with @apex-fusion/cardano)
              npm run build-npm-package

              echo ""
              echo "📦 Building npm-package..."

              # Build the package in npm-package directory
              pushd npm-package > /dev/null

              # Create a local .npmrc for publishing with auth BEFORE npm install
              echo '//localhost:4873/:_authToken="local-dev-token"' > .npmrc
              echo 'registry=http://localhost:4873' >> .npmrc

              npm install
              npm run build

              echo ""
              echo "📤 Publishing to local registry..."

              # Try to unpublish first (ignore errors), then publish
              npm unpublish @apex-fusion/cardano --force 2>/dev/null || true
              npm publish --access public

              popd > /dev/null

              echo ""
              echo "🎉 Package @apex-fusion/cardano published successfully!"
              echo ""
              echo "📋 Usage in other projects:"
              echo "   Add to .npmrc:"
              echo "     registry=http://localhost:4873"
              echo ""
              echo "   Or for @apex-fusion scope only:"
              echo "     @apex-fusion:registry=http://localhost:4873"
              echo ""
              echo "   Then run: npm install @apex-fusion/cardano"
              echo ""
              echo "🌐 Web UI: http://localhost:4873"
              echo ""
              echo "Press Ctrl+C to stop the registry..."

              # Keep running
              wait
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