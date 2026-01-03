/**
 * Setup script to add the WORKING proxy to database
 * and assign it to all workspaces
 */

import { ProxyRepository } from '../database/repositories/proxy.repository';
import { WorkspaceRepository } from '../database/repositories/workspace.repository';
import { ProxyService } from '../services/proxy.service';
import { ProxyProtocol, ProxyType, ProxyStatus } from '../../shared/types/proxy.types';

async function setupWorkingProxy() {
  console.log('\n🔧 === SETTING UP WORKING PROXY ===\n');

  const proxyRepo = new ProxyRepository();
  const workspaceRepo = new WorkspaceRepository();
  const proxyService = new ProxyService();

  // WORKING PROXY DETAILS (from successful curl test)
  const WORKING_PROXY = {
    name: 'Working Proxy - 148.135.224.131',
    host: '148.135.224.131',
    port: 2000,
    protocol: ProxyProtocol.HTTP,
    username: 'appikedia250',
    password: 'Caption15AZ',
    type: ProxyType.STATIC,
    country: 'USA',
  };

  console.log('📋 Step 1: Checking if proxy already exists...\n');

  // Check if this proxy already exists
  const allProxies = proxyRepo.findAll();
  let existingProxy = allProxies.find(p =>
    p.host === WORKING_PROXY.host && p.port === WORKING_PROXY.port
  );

  let proxyId: string;

  if (existingProxy) {
    console.log('✅ Proxy already exists in database!');
    console.log(`   ID: ${existingProxy.id}`);
    console.log(`   Updating credentials and protocol...\n`);

    // Update the existing proxy to ensure correct details
    proxyRepo.delete(existingProxy.id);
    existingProxy = undefined;
  }

  if (!existingProxy) {
    console.log('➕ Creating new proxy in database...\n');

    const newProxy = await proxyService.create({
      name: WORKING_PROXY.name,
      host: WORKING_PROXY.host,
      port: WORKING_PROXY.port,
      protocol: WORKING_PROXY.protocol,
      proxyType: WORKING_PROXY.type,
      username: WORKING_PROXY.username,
      password: WORKING_PROXY.password,
      country: WORKING_PROXY.country,
    });

    console.log('✅ Proxy created successfully!');
    console.log(`   ID: ${newProxy.id}`);
    console.log(`   Host: ${newProxy.host}:${newProxy.port}`);
    console.log(`   Protocol: ${newProxy.protocol}`);
    console.log(`   Type: ${newProxy.type}`);
    console.log(`   Username: ${newProxy.username}`);
    console.log(`   Password: ***SET***\n`);

    proxyId = newProxy.id;
  } else {
    proxyId = existingProxy.id;
  }

  // Step 2: Test the proxy
  console.log('📋 Step 2: Testing proxy connection...\n');

  try {
    const testResult = await proxyService.test(proxyId);

    if (testResult.status === ProxyStatus.ONLINE) {
      console.log('✅ PROXY TEST SUCCESSFUL!');
      console.log(`   Detected IP: ${testResult.ip}`);
      console.log(`   Speed: ${testResult.speed}ms`);
      console.log(`   Status: ${testResult.status}\n`);
    } else {
      console.log('❌ PROXY TEST FAILED!');
      console.log(`   Status: ${testResult.status}`);
      console.log(`   Error: ${testResult.error}\n`);
      console.log('⚠️ WARNING: Proxy not working, but continuing anyway...\n');
    }
  } catch (error) {
    console.log('❌ Proxy test failed with error:', error);
    console.log('⚠️ Continuing anyway...\n');
  }

  // Step 3: Assign to all workspaces
  console.log('📋 Step 3: Assigning proxy to all workspaces...\n');

  const allWorkspaces = workspaceRepo.findAll();

  if (allWorkspaces.length === 0) {
    console.log('⚠️ WARNING: No workspaces found!');
    console.log('   Create workspaces first, then run this script again.\n');
  } else {
    console.log(`Found ${allWorkspaces.length} workspace(s). Assigning proxy...\n`);

    for (const workspace of allWorkspaces) {
      try {
        // Update workspace with proxy ID
        workspaceRepo.update(workspace.id, {
          proxyId: proxyId,
        });

        console.log(`✅ Workspace "${workspace.name}" → Proxy assigned`);
      } catch (error) {
        console.log(`❌ Failed to assign proxy to "${workspace.name}":`, error);
      }
    }

    console.log(`\n✅ Proxy assigned to ${allWorkspaces.length} workspace(s)!\n`);
  }

  // Step 4: Summary
  console.log('📋 Step 4: Verification Summary\n');
  console.log('─'.repeat(60));
  console.log('Proxy Details:');
  console.log(`  Host: ${WORKING_PROXY.host}`);
  console.log(`  Port: ${WORKING_PROXY.port}`);
  console.log(`  Protocol: ${WORKING_PROXY.protocol}`);
  console.log(`  Username: ${WORKING_PROXY.username}`);
  console.log(`  Password: ${WORKING_PROXY.password}`);
  console.log('─'.repeat(60));
  console.log('\n✅ SETUP COMPLETE!\n');
  console.log('Next steps:');
  console.log('  1. Close any open browsers');
  console.log('  2. Launch a workspace');
  console.log('  3. Navigate to https://api.ipify.org');
  console.log('  4. Should see: 148.135.224.131 (NOT 84.239.41.139)');
  console.log('  5. Or check https://whoer.net to verify\n');
  console.log('🔍 If still not working, check browser launch logs for:');
  console.log('   - "PROXY WITH EMBEDDED AUTH"');
  console.log('   - "FINAL PROXY CONFIG"');
  console.log('   - Verify proxy server URL in logs\n');
  console.log('🔍 === END SETUP ===\n');
}

// Run the setup
setupWorkingProxy().catch(error => {
  console.error('❌ Setup script failed:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});
