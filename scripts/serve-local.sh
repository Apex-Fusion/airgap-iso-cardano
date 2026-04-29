#!/usr/bin/env bash
set -e

echo "🚀 AirGap Local NPM Registry"
echo "============================"
echo ""

# Create verdaccio directories
mkdir -p .verdaccio/storage .verdaccio/plugins

# Create verdaccio config
cat > .verdaccio/config.yaml << 'EOF'
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

log:
  type: stdout
  format: pretty
  level: info
EOF

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

# Install dependencies from regular registry (not Verdaccio)
npm install
npm run build

echo ""
echo "📤 Publishing to local registry..."

# Create a local .npmrc for publishing with auth (AFTER install)
echo '//localhost:4873/:_authToken="local-dev-token"' > .npmrc
echo 'registry=http://localhost:4873' >> .npmrc

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
