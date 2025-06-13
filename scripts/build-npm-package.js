#!/usr/bin/env node

/**
 * Script to convert airgap-iso-cardano to @apex-fusion/cardano npm package
 * 
 * This script:
 * 1. Copies source files from src/ to npm-package/src/v1/
 * 2. Transforms imports/exports to match airgap-coin-lib patterns
 * 3. Creates proper package.json structure
 * 4. Sets up build configuration
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.join(__dirname, '..')
const SRC_DIR = path.join(ROOT_DIR, 'src')
const NPM_DIR = path.join(ROOT_DIR, 'npm-package')
const NPM_SRC_DIR = path.join(NPM_DIR, 'src')
const NPM_V1_DIR = path.join(NPM_SRC_DIR, 'v1')

console.log('🚀 Building @apex-fusion/cardano npm package...')

// Clean and create directories
if (fs.existsSync(NPM_DIR)) {
  fs.rmSync(NPM_DIR, { recursive: true })
}
fs.mkdirSync(NPM_DIR, { recursive: true })
fs.mkdirSync(NPM_SRC_DIR, { recursive: true })
fs.mkdirSync(NPM_V1_DIR, { recursive: true })

// Copy source files (excluding tests)
function copyDirectory(src, dest, excludeTests = true) {
  const items = fs.readdirSync(src)
  
  for (const item of items) {
    const srcPath = path.join(src, item)
    const destPath = path.join(dest, item)
    
    if (excludeTests && (item.includes('test') || item.includes('__tests__'))) {
      continue
    }
    
    const stat = fs.statSync(srcPath)
    
    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true })
      copyDirectory(srcPath, destPath, excludeTests)
    } else if (stat.isFile() && item.endsWith('.ts')) {
      // Ensure destination directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      
      let content = fs.readFileSync(srcPath, 'utf8')
      
      // Transform imports to match airgap-coin-lib patterns
      content = transformImports(content, srcPath)
      
      fs.writeFileSync(destPath, content)
      console.log(`📄 Copied: ${path.relative(ROOT_DIR, srcPath)} -> ${path.relative(ROOT_DIR, destPath)}`)
    }
  }
}

function transformImports(content, filePath) {
  // Transform imports based on file location
  if (filePath.includes('src/__tests__')) {
    // src/__tests__ files need to import from v1 directory
    content = content.replace(/from ['"]\.\.\/([^'"]+)['"]/g, 'from "../v1/$1"')
    content = content.replace(/import\(['"]\.\.\/([^'"]+)['"]\)/g, 'import("../v1/$1")')
  } else if (filePath.includes('test/v1')) {
    // test/v1 files need to import from src/v1 instead of src
    // Handle different path depths: ../../src/ and ../../../src/
    content = content.replace(/from ['"]\.\.\/\.\.\/src\/([^'"]+)['"]/g, 'from "../../src/v1/$1"')
    content = content.replace(/from ['"]\.\.\/\.\.\/\.\.\/src\/([^'"]+)['"]/g, 'from "../../../src/v1/$1"')
    content = content.replace(/import\(['"]\.\.\/\.\.\/src\/([^'"]+)['"]\)/g, 'import("../../src/v1/$1")')
    content = content.replace(/import\(['"]\.\.\/\.\.\/\.\.\/src\/([^'"]+)['"]\)/g, 'import("../../../src/v1/$1")')
  }
  
  // Also fix jest.mock() calls in any test file
  if (filePath.includes('__tests__') || filePath.includes('/test/')) {
    content = content.replace(/jest\.mock\(['"]\.\.\/([^'"]+)['"]\)/g, 'jest.mock("../v1/$1")')
  }
  
  return content
}

// Copy source files to v1 directory (excluding the package index)
copyDirectory(SRC_DIR, NPM_V1_DIR)

// Copy test files to npm package
const testDirs = ['test', 'src/__tests__']
for (const testDir of testDirs) {
  const testSrcPath = path.join(ROOT_DIR, testDir)
  const testDestPath = path.join(NPM_DIR, testDir)
  
  if (fs.existsSync(testSrcPath)) {
    copyDirectory(testSrcPath, testDestPath, false) // Include tests
    console.log(`📄 Copied test directory: ${testDir}`)
  }
}

// Copy the package-specific index file as the main v1 index
const packageIndexPath = path.join(SRC_DIR, 'index.package.ts')
const v1IndexPath = path.join(NPM_V1_DIR, 'index.ts')
if (fs.existsSync(packageIndexPath)) {
  let packageIndexContent = fs.readFileSync(packageIndexPath, 'utf8')
  fs.writeFileSync(v1IndexPath, packageIndexContent)
  console.log(`📄 Using package index: ${path.relative(ROOT_DIR, packageIndexPath)} -> ${path.relative(ROOT_DIR, v1IndexPath)}`)
} else {
  console.warn('⚠️  Package index file not found, using default exports')
}

// Create main index files
const mainIndexContent = `export * from './v1'
`

const v1ModuleContent = `import { AirGapModule } from '@airgap/module-kit'
import { CardanoModule } from './index'

export * from './index'

export function create(): AirGapModule {
  return new CardanoModule()
}
`

// Write index files
fs.writeFileSync(path.join(NPM_SRC_DIR, 'index.ts'), mainIndexContent)
fs.writeFileSync(path.join(NPM_V1_DIR, 'module.ts'), v1ModuleContent)

// Create package.json
const packageJson = {
  name: '@apex-fusion/cardano',
  version: '0.13.40',
  description: 'The @apex-fusion/cardano is a Cardano implementation of the ICoinProtocol interface from @airgap/coinlib-core.',
  keywords: [
    'airgap',
    'blockchain', 
    'crypto',
    'cardano',
    'ada'
  ],
  license: 'MIT',
  homepage: 'https://www.airgap.it',
  repository: {
    type: 'git',
    url: 'https://github.com/Apex-Fusion/airgap-iso-cardano'
  },
  publishConfig: {
    access: 'public'
  },
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  scripts: {
    build: 'rm -rf ./dist && npx tsc && node scripts/copy-files-after-build.js',
    'build-scripts': 'tsc scripts/*.ts',
    lint: 'eslint "src/**/*.ts" --ignore-pattern "src/__tests__/**" --ignore-pattern "src/**/*.test.ts"',
    'lint:fix': 'eslint "src/**/*.ts" --ignore-pattern "src/__tests__/**" --ignore-pattern "src/**/*.test.ts" --fix',
    typecheck: 'tsc --noEmit',
    test: 'jest',
    'test-ci': 'npm test',
    browserify: 'browserify ./dist/index.js -s airgapCoinLibCardano > ./dist/airgap-coinlib-cardano.min.js'
  },
  author: 'Papers AG <contact@papers.ch> (https://papers.ch)',
  dependencies: {
    '@airgap/coinlib-core': '^0.13.40',
    '@airgap/module-kit': '^0.13.40', 
    '@airgap/serializer': '^0.13.40',
    '@stablelib/blake2b': '^1.0.1',
    '@stablelib/ed25519': '^1.0.3',
    '@stablelib/sha256': '^1.0.1',
    '@stricahq/bip32ed25519': '^1.1.1',
    '@stricahq/typhonjs': '^3.0.0',
    'bip39': '^3.0.4',
    'buffer': '^6.0.3',
    'cbor-js': '^0.1.0'
  },
  devDependencies: {
    'typescript': '^5.3.3',
    'eslint': '^8.56.0',
    '@typescript-eslint/eslint-plugin': '^6.21.0',
    '@typescript-eslint/parser': '^6.21.0',
    '@types/jest': '^29.5.12',
    '@types/node': '^20.11.17',
    'jest': '^29.7.0',
    'ts-jest': '^29.1.2'
  },
  nyc: {
    include: [
      'src/**/*.ts'
    ],
    exclude: [
      'test/**/*.spec.ts'
    ],
    extension: [
      '.ts'
    ],
    require: [
      'ts-node/register'
    ],
    reporter: [
      'text',
      'text-summary'
    ],
    'report-dir': '../../coverage/cardano',
    sourceMap: true,
    instrument: true
  }
}

fs.writeFileSync(path.join(NPM_DIR, 'package.json'), JSON.stringify(packageJson, null, 2))

// Create TypeScript config
const tsConfig = {
  extends: '../config/tsconfig.json',
  compilerOptions: {
    outDir: './dist',
    rootDir: './src',
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    target: 'es2020',
    lib: ['es2020'],
    module: 'commonjs',
    moduleResolution: 'node',
    skipLibCheck: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    strict: false
  },
  include: [
    'src/**/*'
  ],
  exclude: [
    'dist',
    'node_modules',
    '**/*.test.ts',
    '**/__tests__/**/*'
  ]
}

fs.writeFileSync(path.join(NPM_DIR, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))

// Create build helper scripts directory
const scriptsDir = path.join(NPM_DIR, 'scripts')
fs.mkdirSync(scriptsDir, { recursive: true })

const copyScript = `// Copy non-TS files after build
const fs = require('fs')
const path = require('path')

console.log('📦 Post-build file copying complete')
`

fs.writeFileSync(path.join(scriptsDir, 'copy-files-after-build.js'), copyScript)

// Create basic README
const readme = `# @apex-fusion/cardano

Cardano implementation for AirGap ecosystem.

Generated from airgap-iso-cardano.

## Usage

\`\`\`typescript
import { CardanoModule } from '@apex-fusion/cardano'

const cardanoModule = new CardanoModule()
\`\`\`
`

fs.writeFileSync(path.join(NPM_DIR, 'README.md'), readme)

// Create .npmrc for GitHub Packages
const npmrc = `@apex-fusion:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=\${GITHUB_TOKEN}
`

fs.writeFileSync(path.join(NPM_DIR, '.npmrc'), npmrc)

// Copy configuration files from root project
const configFiles = [
  'eslint.config.mjs',
  'jest.config.js'
]

for (const configFile of configFiles) {
  const srcPath = path.join(ROOT_DIR, configFile)
  const destPath = path.join(NPM_DIR, configFile)
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath)
    console.log(`📄 Copied config: ${configFile}`)
  }
}

// Copy config directory if it exists
const configDirSrc = path.join(ROOT_DIR, 'config')
const configDirDest = path.join(NPM_DIR, 'config')

if (fs.existsSync(configDirSrc)) {
  fs.mkdirSync(configDirDest, { recursive: true })
  const configDirFiles = fs.readdirSync(configDirSrc)
  
  for (const file of configDirFiles) {
    const srcPath = path.join(configDirSrc, file)
    const destPath = path.join(configDirDest, file)
    
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, destPath)
      console.log(`📄 Copied config: config/${file}`)
    }
  }
}

console.log('✅ NPM package structure created successfully!')
console.log('📍 Package location:', path.relative(process.cwd(), NPM_DIR))
console.log('')
console.log('Next steps:')
console.log('1. cd npm-package')
console.log('2. npm run build')
console.log('3. npm publish')
console.log('')
console.log('Or run: npm run publish-cardano-package from the root directory')