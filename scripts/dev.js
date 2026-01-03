/**
 * @fileoverview Development Script
 * @description Runs the application in development mode with hot reload
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🚀 Enterprise RPA Agent - Development Mode\n');

/**
 * Check if Playwright browsers are installed
 */
function checkPlaywright() {
  const browsersPath = path.join(ROOT_DIR, 'node_modules', 'playwright-core', '.local-browsers');
  
  if (!fs.existsSync(browsersPath)) {
    console.log('📥 Installing Playwright browsers...');
    execSync('npx playwright install chromium', { 
      stdio: 'inherit', 
      cwd: ROOT_DIR 
    });
  }
}

/**
 * Start TypeScript compiler in watch mode for Electron
 */
function startElectronTsc() {
  console.log('📦 Starting Electron TypeScript compiler...');
  
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.electron.json', '--watch'], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: ['inherit', 'pipe', 'inherit'],
  });
  
  tsc.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.includes('Watching for file changes')) {
      console.log('   Electron: Ready');
    } else if (output.includes('error')) {
      console.log(`   Electron: ${output}`);
    }
  });
  
  return tsc;
}

/**
 * Start Next.js development server
 */
function startNextDev() {
  console.log('⚛️  Starting Next.js development server...');
  
  const next = spawn('npx', ['next', 'dev'], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: ['inherit', 'pipe', 'inherit'],
    env: { ...process.env, BROWSER: 'none' },
  });
  
  next.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output.includes('Ready')) {
      console.log('   Next.js: Ready on http://localhost:3000');
      // Wait a bit then start Electron
      setTimeout(startElectron, 2000);
    } else if (output) {
      console.log(`   Next.js: ${output}`);
    }
  });
  
  return next;
}

/**
 * Start Electron application
 */
function startElectron() {
  console.log('🖥️  Starting Electron...\n');
  
  const electron = spawn('npx', ['electron', '.'], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_ENV: 'development',
      ELECTRON_DEV_URL: 'http://localhost:3000',
    },
  });
  
  electron.on('close', (code) => {
    console.log(`\nElectron closed with code ${code}`);
    process.exit(code);
  });
  
  return electron;
}

/**
 * Handle cleanup on exit
 */
function setupCleanup(processes) {
  const cleanup = () => {
    console.log('\n🧹 Cleaning up...');
    processes.forEach(p => {
      if (p && !p.killed) {
        p.kill();
      }
    });
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Main entry point
 */
async function main() {
  try {
    checkPlaywright();
    
    const processes = [];
    
    // Start TypeScript compiler for Electron
    processes.push(startElectronTsc());
    
    // Wait for initial compilation
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Start Next.js (which will trigger Electron start when ready)
    processes.push(startNextDev());
    
    setupCleanup(processes);
    
  } catch (error) {
    console.error('❌ Failed to start development mode:', error);
    process.exit(1);
  }
}

main();

