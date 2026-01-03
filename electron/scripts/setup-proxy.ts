/**
 * @fileoverview Proxy Setup Utility Script
 * @module electron/scripts/setup-proxy
 *
 * This script sets up a proxy from command line arguments or environment variables.
 * Run with: npx ts-node electron/scripts/setup-proxy.ts
 * 
 * Usage:
 *   npx ts-node electron/scripts/setup-proxy.ts --host=104.234.148.10 --port=3000 --user=username --pass=password
 *   
 * Or set environment variables:
 *   PROXY_HOST, PROXY_PORT, PROXY_USERNAME, PROXY_PASSWORD
 */

import { ProxyService } from '../services/proxy.service';
import { WorkspaceService } from '../services/workspace.service';
import { ProxyProtocol, ProxyType, ProxyStatus } from '../../shared/types/proxy.types';
import { initializeDatabase, closeDatabase } from '../database/db';

// Parse command line arguments
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (key && value) {
        args[key] = value;
      }
    }
  });
  return args;
}

async function setupProxy() {
  console.log('🔧 RPA Agent Proxy Setup Utility');
  console.log('================================\n');

  // Get proxy details from args or environment
  const args = parseArgs();
  
  const host = args.host || process.env.PROXY_HOST;
  const port = args.port || process.env.PROXY_PORT;
  const username = args.user || args.username || process.env.PROXY_USERNAME;
  const password = args.pass || args.password || process.env.PROXY_PASSWORD;
  const protocol = (args.protocol || process.env.PROXY_PROTOCOL || 'http') as ProxyProtocol;
  const country = args.country || process.env.PROXY_COUNTRY || 'USA';
  const city = args.city || process.env.PROXY_CITY || 'Los Angeles';

  // Validate required fields
  if (!host) {
    console.error('❌ Error: Proxy host is required');
    console.log('\nUsage:');
    console.log('  npx ts-node electron/scripts/setup-proxy.ts --host=104.234.148.10 --port=3000 --user=username --pass=password');
    console.log('\nOr set environment variables:');
    console.log('  PROXY_HOST, PROXY_PORT, PROXY_USERNAME, PROXY_PASSWORD');
    process.exit(1);
  }

  if (!port) {
    console.error('❌ Error: Proxy port is required');
    process.exit(1);
  }

  console.log('📋 Proxy Configuration:');
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port}`);
  console.log(`   Protocol: ${protocol}`);
  console.log(`   Username: ${username ? '***' : '(none)'}`);
  console.log(`   Password: ${password ? '***' : '(none)'}`);
  console.log(`   Country: ${country}`);
  console.log(`   City: ${city}`);
  console.log('');

  try {
    // Initialize database
    console.log('📂 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized\n');

    const proxyService = new ProxyService();
    const workspaceService = new WorkspaceService();

    // Create proxy
    console.log('➕ Creating proxy entry...');
    const proxy = await proxyService.create({
      name: `${host}:${port} (${city}, ${country})`,
      host: host,
      port: parseInt(port),
      protocol: protocol,
      proxyType: ProxyType.STATIC,
      username: username,
      password: password,
      country: country,
      city: city,
    });

    console.log(`✅ Proxy created with ID: ${proxy.id}\n`);

    // Test proxy connection
    console.log('🧪 Testing proxy connection...');
    console.log('   Making request through proxy to detect external IP...\n');
    
    const testResult = await proxyService.test(proxy.id);
    
    if (testResult.status === ProxyStatus.ONLINE) {
      console.log('✅ Proxy test SUCCESSFUL!');
      console.log(`   Detected IP: ${testResult.ip}`);
      console.log(`   Speed: ${testResult.speed}ms`);
      
      // Verify IP is correct
      if (testResult.ip !== host) {
        console.log(`\n⚠️  Note: Detected IP (${testResult.ip}) differs from proxy host (${host})`);
        console.log('   This is normal for ISP/residential proxies where the exit IP differs from the entry IP.');
      }
    } else {
      console.log('❌ Proxy test FAILED!');
      console.log(`   Error: ${testResult.error}`);
      console.log('\n🔍 Troubleshooting tips:');
      console.log('   1. Verify the host and port are correct');
      console.log('   2. Check if username/password are valid');
      console.log('   3. Ensure the proxy server is running');
      console.log('   4. Try using HTTP protocol instead of SOCKS5');
    }
    console.log('');

    // Get all workspaces
    const workspaces = await workspaceService.getAll();
    
    if (workspaces.length > 0) {
      console.log(`📝 Found ${workspaces.length} existing workspaces`);
      console.log('   Would you like to assign this proxy to all workspaces?');
      console.log('   (Run with --assign-all flag to auto-assign)\n');
      
      if (args['assign-all'] === 'true') {
        console.log('🔗 Assigning proxy to all workspaces...');
        for (const workspace of workspaces) {
          try {
            await workspaceService.assignProxy(workspace.id, proxy.id);
            console.log(`   ✅ Assigned to: ${workspace.name}`);
          } catch (err) {
            console.log(`   ❌ Failed for: ${workspace.name} - ${err}`);
          }
        }
        console.log('');
      }
    } else {
      console.log('📝 No existing workspaces found');
      console.log('   New workspaces will need to be assigned this proxy manually\n');
    }

    // Summary
    console.log('================================');
    console.log('📊 Setup Summary:');
    console.log(`   Proxy ID: ${proxy.id}`);
    console.log(`   Status: ${testResult.status.toUpperCase()}`);
    if (testResult.ip) {
      console.log(`   External IP: ${testResult.ip}`);
    }
    console.log('================================\n');

    if (testResult.status === ProxyStatus.ONLINE) {
      console.log('🎉 Proxy is ready to use!');
      console.log('   Launch the RPA Agent and your browsers will use this proxy.');
    } else {
      console.log('⚠️  Proxy setup completed but connection test failed.');
      console.log('   Please verify your proxy credentials and try again.');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    closeDatabase();
  }
}

// Run the setup
setupProxy().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

