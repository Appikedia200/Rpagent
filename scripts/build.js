/**
 * @fileoverview Production Build Script
 * @description Builds the application for production deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_ELECTRON = path.join(ROOT_DIR, 'dist-electron');
const NEXT_OUT = path.join(ROOT_DIR, 'out');

console.log('🏗️  Enterprise RPA Agent - Production Build\n');

/**
 * Execute command with logging
 */
function exec(command, options = {}) {
  console.log(`\n▶ ${command}\n`);
  execSync(command, {
    stdio: 'inherit',
    cwd: ROOT_DIR,
    ...options,
  });
}

/**
 * Clean previous build artifacts
 */
function clean() {
  console.log('🧹 Cleaning previous builds...');
  
  const dirsToClean = [DIST_ELECTRON, NEXT_OUT, path.join(ROOT_DIR, '.next')];
  
  for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`   Removed: ${path.relative(ROOT_DIR, dir)}`);
    }
  }
}

/**
 * Build TypeScript for Electron main process
 */
function buildElectron() {
  console.log('\n📦 Building Electron main process...');
  exec('npx tsc -p tsconfig.electron.json');
}

/**
 * Build Next.js frontend
 */
function buildNextJS() {
  console.log('\n⚛️  Building Next.js frontend...');
  exec('npx next build');
}

/**
 * Copy static assets
 */
function copyAssets() {
  console.log('\n📋 Copying assets...');
  
  // Ensure directories exist
  if (!fs.existsSync(DIST_ELECTRON)) {
    fs.mkdirSync(DIST_ELECTRON, { recursive: true });
  }
  
  // Copy preload script (already compiled by tsc)
  console.log('   Preload script compiled');
  
  // Copy environment template
  const envExample = path.join(ROOT_DIR, '.env.example');
  if (fs.existsSync(envExample)) {
    fs.copyFileSync(envExample, path.join(ROOT_DIR, '.env.example'));
    console.log('   Copied .env.example');
  }
}

/**
 * Validate build output
 */
function validate() {
  console.log('\n✅ Validating build output...');
  
  const requiredFiles = [
    path.join(DIST_ELECTRON, 'electron', 'main.js'),
    path.join(DIST_ELECTRON, 'electron', 'preload.js'),
    path.join(NEXT_OUT, 'index.html'),
  ];
  
  let valid = true;
  
  for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`   ✓ ${path.relative(ROOT_DIR, file)} (${(stats.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`   ✗ Missing: ${path.relative(ROOT_DIR, file)}`);
      valid = false;
    }
  }
  
  return valid;
}

/**
 * Main build process
 */
async function main() {
  const startTime = Date.now();
  
  try {
    clean();
    buildElectron();
    buildNextJS();
    copyAssets();
    
    if (validate()) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n🎉 Build completed successfully in ${duration}s`);
      console.log('\n📦 To create installer, run: npm run dist');
    } else {
      console.log('\n❌ Build validation failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();

