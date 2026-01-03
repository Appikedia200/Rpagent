'use client';

import * as React from 'react';
import {
  Globe,
  Plus,
  Upload,
  RefreshCw,
  Search,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  MoreVertical,
  Zap,
  Lock,
  Home,
  Shuffle,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useProxies } from '@/hooks/use-proxies';
import { ProxyStatus, ProxyProtocol, ProxyType } from '@shared/types/proxy.types';
import { isElectron } from '@/lib/ipc-client';

export default function ProxiesPage() {
  const { proxies, loading, error, loadProxies, createProxy, deleteProxy, testProxy, testAllProxies, bulkImport } = useProxies();
  const [search, setSearch] = React.useState('');
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [importDialogOpen, setImportDialogOpen] = React.useState(false);
  const [addType, setAddType] = React.useState<'static' | 'residential'>('static');
  const [importType, setImportType] = React.useState<'static' | 'residential'>('static');
  const [newProxy, setNewProxy] = React.useState({
    name: '',
    host: '',
    port: '',
    protocol: ProxyProtocol.SOCKS5,
    username: '',
    password: '',
    country: '',
  });
  const [importText, setImportText] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [testingAll, setTestingAll] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'static' | 'residential'>('static');

  // Filter proxies by type
  const staticProxies = proxies.filter(p => (p as any).type === 'static' || !(p as any).type);
  const residentialProxies = proxies.filter(p => (p as any).type === 'residential');
  
  const filteredStaticProxies = staticProxies.filter((proxy) =>
    proxy.name.toLowerCase().includes(search.toLowerCase()) ||
    proxy.host.toLowerCase().includes(search.toLowerCase())
  );
  
  const filteredResidentialProxies = residentialProxies.filter((proxy) =>
    proxy.name.toLowerCase().includes(search.toLowerCase()) ||
    proxy.host.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAddDialog = (type: 'static' | 'residential') => {
    setAddType(type);
    setNewProxy({
      name: '',
      host: '',
      port: '',
      protocol: type === 'static' ? ProxyProtocol.SOCKS5 : ProxyProtocol.HTTP,
      username: '',
      password: '',
      country: '',
    });
    setAddDialogOpen(true);
  };

  const handleOpenImportDialog = (type: 'static' | 'residential') => {
    setImportType(type);
    setImportText('');
    setImportDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!newProxy.host.trim() || !newProxy.port.trim()) return;
    setCreating(true);
    try {
      await createProxy({
        name: newProxy.name || `${newProxy.host}:${newProxy.port}`,
        host: newProxy.host,
        port: parseInt(newProxy.port),
        protocol: newProxy.protocol,
        proxyType: addType as ProxyType,
        username: newProxy.username || undefined,
        password: newProxy.password || undefined,
        country: newProxy.country || undefined,
      });
      setAddDialogOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const count = await bulkImport(importText, importType);
      if (count > 0) {
        setImportDialogOpen(false);
        setImportText('');
      }
    } finally {
      setImporting(false);
    }
  };

  const [testResults, setTestResults] = React.useState<Record<string, { success: boolean; ip?: string; error?: string }>>({});

  const handleTest = async (proxyId: string) => {
    setActionLoading(proxyId);
    setTestResults(prev => ({ ...prev, [proxyId]: { success: false } })); // Clear previous result
    const result = await testProxy(proxyId);
    if (result) {
      setTestResults(prev => ({
        ...prev,
        [proxyId]: {
          success: result.status === 'online',
          ip: result.ip,
          error: result.error,
        },
      }));
    }
    setActionLoading(null);
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    setTestResults({}); // Clear all results
    const results = await testAllProxies();
    const newResults: Record<string, { success: boolean; ip?: string; error?: string }> = {};
    results.forEach(r => {
      newResults[r.proxyId] = {
        success: r.status === 'online',
        ip: r.ip,
        error: r.error,
      };
    });
    setTestResults(newResults);
    setTestingAll(false);
  };

  const handleDelete = async (proxyId: string) => {
    setActionLoading(proxyId);
    await deleteProxy(proxyId);
    setActionLoading(null);
  };

  const getStatusBadge = (status: ProxyStatus) => {
    switch (status) {
      case ProxyStatus.ONLINE:
        return <Badge variant="success">Online</Badge>;
      case ProxyStatus.OFFLINE:
        return <Badge variant="secondary">Offline</Badge>;
      case ProxyStatus.ERROR:
        return <Badge variant="destructive">Error</Badge>;
      case ProxyStatus.TESTING:
        return <Badge variant="outline">Testing...</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const staticOnline = staticProxies.filter(p => p.status === ProxyStatus.ONLINE).length;
  const staticAssigned = staticProxies.filter(p => (p as any).assignedToWorkspace).length;
  const residentialOnline = residentialProxies.filter(p => p.status === ProxyStatus.ONLINE).length;

  // Show warning if not in Electron
  if (!isElectron()) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Proxies</h1>
            <p className="text-muted-foreground">
              Manage proxy servers for browser automation
            </p>
          </div>
        </div>
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <div>
                <h3 className="font-medium">Electron Required</h3>
                <p className="text-sm text-muted-foreground">
                  Proxy management requires the Electron desktop application.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderProxyList = (proxyList: typeof proxies, type: 'static' | 'residential') => (
    <ScrollArea className="h-[400px]">
      {loading && proxyList.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : proxyList.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-12">
          {type === 'static' ? (
            <Lock className="h-12 w-12 text-blue-500/50 mb-4" />
          ) : (
            <Home className="h-12 w-12 text-green-500/50 mb-4" />
          )}
          <h3 className="text-lg font-medium">
            No {type === 'static' ? 'Static' : 'Residential'} Proxies
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {type === 'static' 
              ? 'Add static IPs for account creation (1 IP per browser)' 
              : 'Add residential proxies for content viewing (rotating IPs)'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenImportDialog(type)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </Button>
            <Button onClick={() => handleOpenAddDialog(type)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Proxy
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {proxyList.map((proxy) => (
            <div 
              key={proxy.id} 
              className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                proxy.status === ProxyStatus.ONLINE 
                  ? 'bg-accent/5 border-accent/20' 
                  : 'bg-muted/30'
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-lg',
                  type === 'static' ? 'bg-blue-500/20' : 'bg-green-500/20'
                )}>
                  {type === 'static' ? (
                    <Lock className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Shuffle className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{proxy.name}</p>
                    {getStatusBadge(proxy.status)}
                    <Badge variant="outline" className="text-xs">{proxy.protocol.toUpperCase()}</Badge>
                    {(proxy as any).assignedToWorkspace && (
                      <Badge className="bg-accent/20 text-accent text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Assigned
                      </Badge>
                    )}
                    {/* Show detected IP if available */}
                    {testResults[proxy.id]?.ip && (
                      <Badge className="bg-green-500/20 text-green-400 text-xs font-mono">
                        IP: {testResults[proxy.id].ip}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {proxy.host}:{proxy.port}
                  </p>
                  {/* Show error message if test failed */}
                  {testResults[proxy.id]?.error && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {testResults[proxy.id].error}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {proxy.speed && (
                  <span className="text-xs text-accent">{proxy.speed}ms</span>
                )}
                {actionLoading === proxy.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleTest(proxy.id)}>
                        <Zap className="h-4 w-4 mr-2" />
                        Test Connection
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(proxy.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proxy Manager</h1>
          <p className="text-muted-foreground">
            Manage Static IPs and Residential Proxy Pools
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTestAll}
            disabled={testingAll || proxies.length === 0}
          >
            {testingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Test All
          </Button>
          <Button variant="outline" size="icon" onClick={loadProxies} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Static IPs</CardTitle>
            <Lock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{staticProxies.length}</div>
            <p className="text-xs text-muted-foreground">
              {staticOnline} online • {staticAssigned} assigned
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Residential Pool</CardTitle>
            <Home className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{residentialProxies.length}</div>
            <p className="text-xs text-muted-foreground">
              {residentialOnline} online • rotating
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Online</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {staticOnline + residentialOnline}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Static</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {staticProxies.length - staticAssigned}
            </div>
            <p className="text-xs text-muted-foreground">for new browsers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search proxies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabbed Proxy Lists */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'static' | 'residential')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="static" className="gap-2">
            <Lock className="h-4 w-4" />
            Static IPs ({staticProxies.length})
          </TabsTrigger>
          <TabsTrigger value="residential" className="gap-2">
            <Home className="h-4 w-4" />
            Residential ({residentialProxies.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="static">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-blue-500" />
                    Static IP Pool
                  </CardTitle>
                  <CardDescription>
                    Fixed IPs for account creation - each browser gets ONE permanent IP
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenImportDialog('static')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Import
                  </Button>
                  <Button size="sm" onClick={() => handleOpenAddDialog('static')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Static IP
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderProxyList(filteredStaticProxies, 'static')}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="residential">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-green-500" />
                    Residential Proxy Pool
                  </CardTitle>
                  <CardDescription>
                    Rotating IPs for content viewing - different IP each session
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenImportDialog('residential')}>
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Import
                  </Button>
                  <Button size="sm" onClick={() => handleOpenAddDialog('residential')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Residential
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderProxyList(filteredResidentialProxies, 'residential')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Proxy Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {addType === 'static' ? (
                <>
                  <Lock className="h-5 w-5 text-blue-500" />
                  Add Static IP
                </>
              ) : (
                <>
                  <Home className="h-5 w-5 text-green-500" />
                  Add Residential Proxy
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {addType === 'static' 
                ? 'Static IPs are permanently assigned to browser profiles for account creation.'
                : 'Residential proxies rotate IPs and are used for content viewing.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  placeholder="192.168.1.1"
                  value={newProxy.host}
                  onChange={(e) => setNewProxy(p => ({ ...p, host: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  placeholder="8080"
                  type="number"
                  value={newProxy.port}
                  onChange={(e) => setNewProxy(p => ({ ...p, port: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select
                value={newProxy.protocol}
                onValueChange={(v) => setNewProxy(p => ({ ...p, protocol: v as ProxyProtocol }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="socks5">SOCKS5 (Recommended for Static)</SelectItem>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="https">HTTPS</SelectItem>
                  <SelectItem value="socks4">SOCKS4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                placeholder={`${addType === 'static' ? 'US-Static-1' : 'Residential-Pool-1'}`}
                value={newProxy.name}
                onChange={(e) => setNewProxy(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="username"
                  value={newProxy.username}
                  onChange={(e) => setNewProxy(p => ({ ...p, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="password"
                  value={newProxy.password}
                  onChange={(e) => setNewProxy(p => ({ ...p, password: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={creating || !newProxy.host || !newProxy.port}
              className={addType === 'static' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add {addType === 'static' ? 'Static IP' : 'Residential Proxy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importType === 'static' ? (
                <>
                  <Lock className="h-5 w-5 text-blue-500" />
                  Import Static IPs
                </>
              ) : (
                <>
                  <Home className="h-5 w-5 text-green-500" />
                  Import Residential Proxies
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Paste your proxy list below. One proxy per line.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proxy List</Label>
              <Textarea
                placeholder={`host:port:username:password\nhost:port:username:password\nsocks5://user:pass@host:port`}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Supported formats:</p>
                <ul className="list-disc list-inside pl-2">
                  <li>host:port</li>
                  <li>host:port:username:password</li>
                  <li>protocol://host:port</li>
                  <li>protocol://username:password@host:port</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={importing || !importText.trim()}
              className={importType === 'static' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import to {importType === 'static' ? 'Static' : 'Residential'} Pool
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
