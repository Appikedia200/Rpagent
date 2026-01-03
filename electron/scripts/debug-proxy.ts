/**
 * Debug script to check proxy configuration
 * Run this to see what's actually in the database
 */

import { ProxyRepository } from '../database/repositories/proxy.repository';
import { WorkspaceRepository } from '../database/repositories/workspace.repository';
import { ProxyService } from '../services/proxy.service';
import { ProxyProtocol, ProxyType } from '../../shared/types/proxy.types';

async function debugProxy() {
  console.log('\n🔍 === PROXY DEBUG REPORT ===\n');

  const proxyRepo = new ProxyRepository();
  const workspaceRepo = new WorkspaceRepository();
  const proxyService = new ProxyService();

  // 1. Check all proxies in database
  console.log('📋 1. CHECKING PROXIES IN DATABASE:\n');
  const allProxies = proxyRepo.findAll();

  if (allProxies.length === 0) {
    console.log('❌ NO PROXIES FOUND IN DATABASE!');
    console.log('   This is why browser is not using proxy.\n');
  } else {
    console.log(`✅ Found ${allProxies.length} proxy(ies):\n`);
    allProxies.forEach((proxy, index) => {
      console.log(`   Proxy ${index + 1}:`);
      console.log(`   - ID: ${proxy.id}`);
      console.log(`   - Name: ${proxy.name}`);
      console.log(`   - Host: ${proxy.host}`);
      console.log(`   - Port: ${proxy.port}`);
      console.log(`   - Protocol: ${proxy.protocol}`);
      console.log(`   - Type: ${proxy.type || 'NOT SET'}`);
      console.log(`   - Username: ${proxy.username || 'NOT SET'}`);
      console.log(`   - Password: ${proxy.password ? '***SET***' : 'NOT SET'}`);
      console.log(`   - Status: ${proxy.status}`);
      console.log(`   - Assigned to workspace: ${proxy.assignedToWorkspace || 'NOT ASSIGNED'}`);
      console.log('');
    });
  }

  // 2. Check all workspaces
  console.log('\n📋 2. CHECKING WORKSPACES:\n');
  const allWorkspaces = workspaceRepo.findAll();

  if (allWorkspaces.length === 0) {
    console.log('❌ NO WORKSPACES FOUND!');
  } else {
    console.log(`✅ Found ${allWorkspaces.length} workspace(s):\n`);
    allWorkspaces.forEach((workspace, index) => {
      console.log(`   Workspace ${index + 1}:`);
      console.log(`   - ID: ${workspace.id}`);
      console.log(`   - Name: ${workspace.name}`);
      console.log(`   - Status: ${workspace.status}`);
      console.log(`   - Proxy ID: ${workspace.proxyId || '❌ NO PROXY ASSIGNED'}`);

      if (workspace.proxyId) {
        const assignedProxy = proxyRepo.findById(workspace.proxyId);
        if (assignedProxy) {
          console.log(`   - Proxy Details: ${assignedProxy.host}:${assignedProxy.port}`);
        } else {
          console.log(`   - ⚠️ WARNING: Proxy ID exists but proxy NOT FOUND in database!`);
        }
      }
      console.log('');
    });
  }

  // 3. Check if working proxy is in database
  console.log('\n📋 3. CHECKING FOR WORKING PROXY (148.135.224.131:2000):\n');
  const workingProxyExists = allProxies.find(p =>
    p.host === '148.135.224.131' && p.port === 2000
  );

  if (workingProxyExists) {
    console.log('✅ Working proxy FOUND in database!');
    console.log(`   - ID: ${workingProxyExists.id}`);
    console.log(`   - Username: ${workingProxyExists.username}`);
    console.log(`   - Password: ${workingProxyExists.password ? '***SET***' : 'NOT SET'}`);
    console.log(`   - Protocol: ${workingProxyExists.protocol}`);
    console.log(`   - Assigned to: ${workingProxyExists.assignedToWorkspace || 'NOT ASSIGNED'}`);
  } else {
    console.log('❌ Working proxy (148.135.224.131:2000) NOT in database!');
    console.log('   This is why browser is not using it.\n');
    console.log('🔧 SOLUTION: We need to add this proxy to the database.');
  }

  // 4. Summary and recommendations
  console.log('\n📋 4. RECOMMENDATIONS:\n');

  if (allProxies.length === 0) {
    console.log('❌ CRITICAL: No proxies in database');
    console.log('   → Run the setup script to add your working proxy\n');
  } else if (!workingProxyExists) {
    console.log('❌ CRITICAL: Your working proxy is not in the database');
    console.log('   → Database has different proxy details');
    console.log('   → Need to add 148.135.224.131:2000 to database\n');
  } else {
    const workspacesWithoutProxy = allWorkspaces.filter(w => !w.proxyId);
    if (workspacesWithoutProxy.length > 0) {
      console.log(`⚠️ WARNING: ${workspacesWithoutProxy.length} workspace(s) don't have proxy assigned`);
      console.log('   → Need to assign proxy to workspaces\n');
    } else {
      console.log('✅ All workspaces have proxies assigned!');
      console.log('   If browser still not using proxy, check browser launch logs.\n');
    }
  }

  console.log('\n🔍 === END DEBUG REPORT ===\n');
}

// Run the debug
debugProxy().catch(error => {
  console.error('❌ Debug script failed:', error);
  process.exit(1);
});
