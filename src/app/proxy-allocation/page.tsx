'use client';

import * as React from 'react';
import {
  Shield,
  Home,
  RefreshCw,
  Loader2,
  Check,
  X,
  Zap,
  Globe,
  Lock,
  Shuffle,
  Save,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Proxy {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  type: string;
  status: string;
  assignedToWorkspace?: string;
}

interface Workspace {
  id: string;
  name: string;
  status: string;
  proxyId?: string;
  proxyIp?: string;
  accountEmail?: string;
}

interface AllocationSettings {
  proxyMode: 'static' | 'residential';
  autoAllocate: boolean;
  rotateOnNewSession: boolean;
}

export default function ProxyAllocationPage() {
  const [proxies, setProxies] = React.useState<Proxy[]>([]);
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [allocating, setAllocating] = React.useState(false);
  const [settings, setSettings] = React.useState<AllocationSettings>({
    proxyMode: 'static',
    autoAllocate: true,
    rotateOnNewSession: false,
  });
  const [settingsChanged, setSettingsChanged] = React.useState(false);

  React.useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [proxiesData, workspacesData] = await Promise.all([
        window.electron?.invoke<Proxy[]>('proxy:getAll'),
        window.electron?.invoke<Workspace[]>('workspace:getAll'),
      ]);
      setProxies(proxiesData || []);
      setWorkspaces(workspacesData || []);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await window.electron?.invoke<{ proxyMode?: string; autoAllocate?: boolean; rotateOnNewSession?: boolean }>('settings:get');
      if (savedSettings) {
        setSettings({
          proxyMode: (savedSettings.proxyMode as 'static' | 'residential') || 'static',
          autoAllocate: savedSettings.autoAllocate ?? true,
          rotateOnNewSession: savedSettings.rotateOnNewSession ?? false,
        });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await window.electron?.invoke('settings:save', settings);
      setSettingsChanged(false);
    } catch (e) {
      console.error('Failed to save settings:', e);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (updates: Partial<AllocationSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setSettingsChanged(true);
  };

  const staticProxies = proxies.filter(p => p.type === 'static' || !p.type);
  const residentialProxies = proxies.filter(p => p.type === 'residential');
  const assignedStaticCount = staticProxies.filter(p => p.assignedToWorkspace).length;
  const availableStaticCount = staticProxies.filter(p => !p.assignedToWorkspace).length;

  // Get allocation status for each workspace
  const getAllocations = () => {
    return workspaces.map(ws => {
      const proxy = proxies.find(p => p.id === ws.proxyId);
      return {
        workspace: ws,
        proxy,
        hasProxy: !!proxy,
        proxyType: proxy?.type || 'none',
      };
    });
  };

  const autoAllocateAll = async () => {
    setAllocating(true);
    try {
      const unassignedWorkspaces = workspaces.filter(ws => !ws.proxyId);
      const poolToUse = settings.proxyMode === 'static' 
        ? staticProxies.filter(p => !p.assignedToWorkspace)
        : residentialProxies;

      // For static mode, allocate one proxy per workspace
      // For residential mode, we could assign the same pool proxy or rotate
      for (let i = 0; i < Math.min(unassignedWorkspaces.length, poolToUse.length); i++) {
        await window.electron?.invoke('workspace:assignProxy', {
          workspaceId: unassignedWorkspaces[i].id,
          proxyId: poolToUse[i].id,
        });
      }

      await loadData();
    } catch (e) {
      console.error('Failed to auto-allocate:', e);
    } finally {
      setAllocating(false);
    }
  };

  const clearAllAllocations = async () => {
    setAllocating(true);
    try {
      for (const ws of workspaces.filter(w => w.proxyId)) {
        await window.electron?.invoke('workspace:unassignProxy', { workspaceId: ws.id });
      }
      await loadData();
    } catch (e) {
      console.error('Failed to clear allocations:', e);
    } finally {
      setAllocating(false);
    }
  };

  const allocations = getAllocations();
  const currentPoolEmpty = settings.proxyMode === 'static' ? availableStaticCount === 0 : residentialProxies.length === 0;

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proxy Allocation</h1>
          <p className="text-muted-foreground">
            Configure how proxies are assigned to browser profiles
          </p>
        </div>
        <div className="flex gap-2">
          {settingsChanged && (
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          )}
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card 
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg border-2',
            settings.proxyMode === 'static' 
              ? 'ring-2 ring-blue-500 bg-blue-500/5 border-blue-500/50' 
              : 'border-transparent hover:border-blue-500/30'
          )}
          onClick={() => updateSettings({ proxyMode: 'static' })}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg',
                  settings.proxyMode === 'static' ? 'bg-blue-500/30' : 'bg-blue-500/10'
                )}>
                  <Lock className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-blue-400">Static IP Mode</CardTitle>
                  <CardDescription>For account creation & management</CardDescription>
                </div>
              </div>
              {settings.proxyMode === 'static' && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Each browser gets ONE permanent IP
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Same IP every time you open that browser
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Best for Gmail/YouTube account creation
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                IP stays with the profile forever
              </li>
            </ul>
            <div className="mt-4 pt-3 border-t border-blue-500/20">
              <span className="text-xs text-blue-400 font-medium">
                {staticProxies.length} static IPs available • {availableStaticCount} unassigned
              </span>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg border-2',
            settings.proxyMode === 'residential' 
              ? 'ring-2 ring-green-500 bg-green-500/5 border-green-500/50' 
              : 'border-transparent hover:border-green-500/30'
          )}
          onClick={() => updateSettings({ proxyMode: 'residential' })}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg',
                  settings.proxyMode === 'residential' ? 'bg-green-500/30' : 'bg-green-500/10'
                )}>
                  <Shuffle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <CardTitle className="text-green-400">Residential Mode</CardTitle>
                  <CardDescription>For content viewing & streaming</CardDescription>
                </div>
              </div>
              {settings.proxyMode === 'residential' && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                IPs rotate from residential pool
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Different IP each session (optional)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Best for YouTube watching (FarmOS)
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Not tied to browser profiles
              </li>
            </ul>
            <div className="mt-4 pt-3 border-t border-green-500/20">
              <span className="text-xs text-green-400 font-medium">
                {residentialProxies.length} residential proxies in pool
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning if pool is empty */}
      {currentPoolEmpty && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium text-yellow-500">
                  No {settings.proxyMode === 'static' ? 'available static IPs' : 'residential proxies'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Go to <strong>Proxies</strong> page to add {settings.proxyMode === 'static' ? 'static IPs' : 'residential proxies'} first.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={cn(
          'transition-all',
          settings.proxyMode === 'static' && 'ring-2 ring-blue-500/50'
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Static IPs</CardTitle>
            <Lock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{staticProxies.length}</div>
            <p className="text-xs text-muted-foreground">{availableStaticCount} available</p>
          </CardContent>
        </Card>
        <Card className={cn(
          'transition-all',
          settings.proxyMode === 'residential' && 'ring-2 ring-green-500/50'
        )}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Residential Pool</CardTitle>
            <Home className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{residentialProxies.length}</div>
            <p className="text-xs text-muted-foreground">rotating</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assigned</CardTitle>
            <Shield className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{assignedStaticCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Settings & Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Allocation Settings</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={clearAllAllocations}
                disabled={allocating || assignedStaticCount === 0}
              >
                <X className="h-4 w-4 mr-2" />
                Clear All
              </Button>
              <Button 
                onClick={autoAllocateAll}
                disabled={allocating || currentPoolEmpty}
                className={settings.proxyMode === 'static' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
              >
                {allocating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Auto-Allocate from {settings.proxyMode === 'static' ? 'Static' : 'Residential'} Pool
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-allocate on browser creation</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically assign a proxy from the selected pool when a new browser is created
                </p>
              </div>
              <Switch
                checked={settings.autoAllocate}
                onCheckedChange={(v) => updateSettings({ autoAllocate: v })}
              />
            </div>
            
            {settings.proxyMode === 'residential' && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Rotate on new session</Label>
                  <p className="text-xs text-muted-foreground">
                    Get a new residential IP each time browser is launched
                  </p>
                </div>
                <Switch
                  checked={settings.rotateOnNewSession}
                  onCheckedChange={(v) => updateSettings({ rotateOnNewSession: v })}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Allocation Table */}
      <Card>
        <CardHeader>
          <CardTitle>Browser → IP Mapping</CardTitle>
          <CardDescription>
            Shows which browser profile uses which IP address
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : allocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No workspaces yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create workspaces via Command Center to see allocations
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {allocations.map(({ workspace, proxy, hasProxy, proxyType }) => (
                  <div
                    key={workspace.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      hasProxy 
                        ? proxyType === 'residential' 
                          ? 'bg-green-500/5 border-green-500/20' 
                          : 'bg-blue-500/5 border-blue-500/20'
                        : 'bg-muted/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        hasProxy 
                          ? proxyType === 'residential'
                            ? 'bg-green-500/20'
                            : 'bg-blue-500/20' 
                          : 'bg-muted'
                      )}>
                        {hasProxy ? (
                          proxyType === 'residential' ? (
                            <Shuffle className="h-5 w-5 text-green-500" />
                          ) : (
                            <Lock className="h-5 w-5 text-blue-500" />
                          )
                        ) : (
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{workspace.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{workspace.id.slice(0, 8)}</span>
                          {workspace.accountEmail && (
                            <>
                              <span>•</span>
                              <span className="text-accent">{workspace.accountEmail}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {hasProxy ? (
                        <div className="text-right">
                          <p className={cn(
                            'font-mono text-sm',
                            proxyType === 'residential' ? 'text-green-400' : 'text-blue-400'
                          )}>
                            {proxy?.host}:{proxy?.port}
                          </p>
                          <p className="text-xs text-muted-foreground">{proxy?.name}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">No proxy assigned</span>
                      )}
                      <Badge 
                        variant={hasProxy ? 'default' : 'secondary'} 
                        className={cn(
                          hasProxy && proxyType === 'residential' && 'bg-green-500/20 text-green-400',
                          hasProxy && proxyType !== 'residential' && 'bg-blue-500/20 text-blue-400',
                        )}
                      >
                        {hasProxy 
                          ? proxyType === 'residential' ? 'Residential' : 'Static IP'
                          : 'Direct'
                        }
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
