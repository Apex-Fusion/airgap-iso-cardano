// Copy non-TS files after build
const fs = require('fs')
const path = require('path')

// Copy assets to dist folder
const assetsSrc = path.join(__dirname, '..', 'assets')
const assetsDest = path.join(__dirname, '..', 'dist', 'assets')

if (fs.existsSync(assetsSrc)) {
  fs.mkdirSync(assetsDest, { recursive: true })
  const files = fs.readdirSync(assetsSrc)
  for (const file of files) {
    fs.copyFileSync(path.join(assetsSrc, file), path.join(assetsDest, file))
  }
  console.log('🎨 Copied assets to dist/assets/')
}

console.log('📦 Post-build file copying complete')
