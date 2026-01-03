'use client';

import * as React from 'react';
import {
  Plus,
  Layers,
  Globe,
  Play,
  Pause,
  Trash2,
  MoreVertical,
  RefreshCw,
  Loader2,
  Search,
  Network,
  Link,
  Unlink,
  Shield,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useWorkspaces } from '@/hooks/use-workspaces';
import { WorkspaceStatus } from '@shared/types/workspace.types';

interface Proxy {
  id: string;
  name: string;
  host: string;
  port: number;
  type: string;
  status: string;
  assignedToWorkspace?: string;
}

export default function WorkspacesPage() {
  const { workspaces, loading, error: wsError, createWorkspace, deleteWorkspace, loadWorkspaces, launchBrowser, closeBrowser } = useWorkspaces();
  const [search, setSearch] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = React.useState('');
  const [selectedProxyId, setSelectedProxyId] = React.useState<string>('');
  const [bulkCount, setBulkCount] = React.useState(1);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [proxies, setProxies] = React.useState<Proxy[]>([]);
  const [selectedWorkspaces, setSelectedWorkspaces] = React.useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [launchError, setLaunchError] = React.useState<string | null>(null);

  // Clear error after 5 seconds
  React.useEffect(() => {
    if (launchError) {
      const timer = setTimeout(() => setLaunchError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [launchError]);

  // Handle browser launch with error feedback
  const handleLaunchBrowser = async (id: string) => {
    setLaunchError(null);
    const success = await launchBrowser(id);
    if (!success && wsError) {
      setLaunchError(wsError);
    }
  };

  // Load proxies
  React.useEffect(() => {
    loadProxies();
  }, []);

  const loadProxies = async () => {
    try {
      const result = await window.electron?.invoke<Proxy[]>('proxy:getAll');
      setProxies(result || []);
    } catch (e) {
      console.error('Failed to load proxies:', e);
    }
  };

  const filteredWorkspaces = workspaces.filter((ws) =>
    ws.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get static proxies only (for permanent assignment)
  const staticProxies = proxies.filter(p => p.type === 'static' && !p.assignedToWorkspace);
  
  // Get proxy details for a workspace
  const getWorkspaceProxy = (proxyId?: string) => {
    if (!proxyId) return null;
    return proxies.find(p => p.id === proxyId);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      if (bulkCount > 1) {
        for (let i = 0; i < bulkCount; i++) {
          await createWorkspace({
            name: `${newWorkspaceName || 'Workspace'} ${i + 1}`,
            proxyId: selectedProxyId || undefined,
          });
        }
      } else {
        await createWorkspace({
          name: newWorkspaceName || 'New Workspace',
          proxyId: selectedProxyId || undefined,
        });
      }
      setCreateDialogOpen(false);
      setNewWorkspaceName('');
      setSelectedProxyId('');
      setBulkCount(1);
      await loadProxies(); // Reload to update assignments
    } finally {
      setCreating(false);
    }
  };

  const assignProxy = async (workspaceId: string, proxyId: string) => {
    try {
      await window.electron?.invoke('workspace:assignProxy', { workspaceId, proxyId });
      await loadWorkspaces();
      await loadProxies();
    } catch (e) {
      console.error('Failed to assign proxy:', e);
    }
  };

  const unassignProxy = async (workspaceId: string) => {
    try {
      await window.electron?.invoke('workspace:unassignProxy', { workspaceId });
      await loadWorkspaces();
      await loadProxies();
    } catch (e) {
      console.error('Failed to unassign proxy:', e);
    }
  };

  const toggleSelectWorkspace = (id: string) => {
    const newSelection = new Set(selectedWorkspaces);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedWorkspaces(newSelection);
  };

  const selectAll = () => {
    setSelectedWorkspaces(new Set(filteredWorkspaces.map(w => w.id)));
  };

  const deselectAll = () => {
    setSelectedWorkspaces(new Set());
  };

  const deleteSelected = async () => {
    setDeleting(true);
    try {
      for (const id of selectedWorkspaces) {
        await deleteWorkspace(id);
      }
      setSelectedWorkspaces(new Set());
      setSelectionMode(false);
    } finally {
      setDeleting(false);
    }
  };

  const deleteAll = async () => {
    setDeleting(true);
    try {
      for (const ws of workspaces) {
        await deleteWorkspace(ws.id);
      }
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: WorkspaceStatus) => {
    switch (status) {
      case WorkspaceStatus.IDLE:
        return 'bg-muted-foreground';
      case WorkspaceStatus.ACTIVE:
        return 'bg-green-500';
      case WorkspaceStatus.LOADING:
        return 'bg-yellow-500';
      case WorkspaceStatus.PAUSED:
        return 'bg-orange-500';
      case WorkspaceStatus.ERROR:
        return 'bg-destructive';
      default:
        return 'bg-muted-foreground';
    }
  };

  const getStatusBadge = (status: WorkspaceStatus) => {
    switch (status) {
      case WorkspaceStatus.IDLE:
        return <Badge variant="secondary">Idle</Badge>;
      case WorkspaceStatus.ACTIVE:
        return <Badge className="bg-green-500/20 text-green-400">Active</Badge>;
      case WorkspaceStatus.LOADING:
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Loading</Badge>;
      case WorkspaceStatus.PAUSED:
        return <Badge variant="outline" className="text-orange-500 border-orange-500">Paused</Badge>;
      case WorkspaceStatus.ERROR:
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const withProxy = workspaces.filter(w => w.proxyId).length;
  const withoutProxy = workspaces.filter(w => !w.proxyId).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage browser profiles with permanent IP assignments
          </p>
        </div>
        <div className="flex gap-2">
          {/* Selection Mode Actions */}
          {selectionMode ? (
            <>
              <Button variant="outline" size="sm" onClick={selectAll}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                <Square className="h-4 w-4 mr-2" />
                Deselect All
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={deleteSelected}
                disabled={selectedWorkspaces.size === 0 || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Selected ({selectedWorkspaces.size})
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setSelectionMode(false); setSelectedWorkspaces(new Set()); }}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Select
              </Button>
              
              {/* Delete All Dialog */}
              <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete All
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Delete All Workspaces
                    </DialogTitle>
                    <DialogDescription>
                      This will permanently delete all {workspaces.length} workspaces and their browser profiles. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={deleteAll} disabled={deleting}>
                      {deleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete All {workspaces.length} Workspaces
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          
          {/* Create Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Workspace
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workspace</DialogTitle>
              <DialogDescription>
                Create a browser workspace with optional static IP assignment
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  placeholder="My Workspace"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Assign Static IP (Optional)</Label>
                <Select value={selectedProxyId} onValueChange={setSelectedProxyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No proxy - will use direct connection" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No proxy</SelectItem>
                    {staticProxies.map((proxy) => (
                      <SelectItem key={proxy.id} value={proxy.id}>
                        <div className="flex items-center gap-2">
                          <Network className="h-3 w-3" />
                          <span>{proxy.name}</span>
                          <span className="text-muted-foreground">({proxy.host}:{proxy.port})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Static IPs are permanently assigned to this workspace. The same IP will be used every time.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="count">Number of Workspaces</Label>
                <Input
                  id="count"
                  type="number"
                  min={1}
                  max={100}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create {bulkCount > 1 ? `${bulkCount} Workspaces` : 'Workspace'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Workspaces</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">With Static IP</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{withProxy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Without Proxy</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{withoutProxy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workspaces.filter((w) => w.status === WorkspaceStatus.ACTIVE).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workspaces List */}
      {/* Error Alert */}
      {launchError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Browser Launch Failed</p>
                <p className="text-sm text-destructive/80">{launchError}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto text-destructive"
                onClick={() => setLaunchError(null)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Workspaces</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => { loadWorkspaces(); loadProxies(); }}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {loading && workspaces.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredWorkspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Layers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No workspaces found</h3>
                <p className="text-sm text-muted-foreground">
                  {search ? 'Try a different search term' : 'Create your first workspace to get started'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredWorkspaces.map((workspace) => {
                  const proxy = getWorkspaceProxy(workspace.proxyId);
                  const isSelected = selectedWorkspaces.has(workspace.id);
                  return (
                    <Card 
                      key={workspace.id} 
                      className={cn(
                        "relative group cursor-pointer transition-all",
                        selectionMode && isSelected && "ring-2 ring-primary bg-primary/5",
                        selectionMode && "hover:ring-2 hover:ring-primary/50"
                      )}
                      onClick={() => selectionMode && toggleSelectWorkspace(workspace.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {/* Selection checkbox */}
                            {selectionMode && (
                              <div 
                                className={cn(
                                  "flex h-6 w-6 items-center justify-center rounded border-2 transition-all",
                                  isSelected 
                                    ? "bg-primary border-primary" 
                                    : "border-muted-foreground/30 hover:border-primary/50"
                                )}
                                onClick={(e) => { e.stopPropagation(); toggleSelectWorkspace(workspace.id); }}
                              >
                                {isSelected && <CheckSquare className="h-4 w-4 text-primary-foreground" />}
                              </div>
                            )}
                            <div className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-lg',
                              proxy ? 'bg-green-500/20' : 'bg-gradient-to-br from-primary/20 to-primary/5'
                            )}>
                              {proxy ? (
                                <Shield className="h-5 w-5 text-green-500" />
                              ) : (
                                <Globe className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{workspace.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className={cn(
                                  'h-2 w-2 rounded-full',
                                  getStatusColor(workspace.status)
                                )} />
                                {getStatusBadge(workspace.status)}
                              </div>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleLaunchBrowser(workspace.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Launch Browser
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => closeBrowser(workspace.id)}>
                                <Pause className="h-4 w-4 mr-2" />
                                Close Browser
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              
                              {/* Proxy Assignment Submenu */}
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Network className="h-4 w-4 mr-2" />
                                  {proxy ? 'Change Proxy' : 'Assign Proxy'}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {staticProxies.length === 0 ? (
                                    <DropdownMenuItem disabled>
                                      No available static proxies
                                    </DropdownMenuItem>
                                  ) : (
                                    staticProxies.map((p) => (
                                      <DropdownMenuItem 
                                        key={p.id}
                                        onClick={() => assignProxy(workspace.id, p.id)}
                                      >
                                        <Link className="h-4 w-4 mr-2" />
                                        {p.name} ({p.host})
                                      </DropdownMenuItem>
                                    ))
                                  )}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                              
                              {proxy && (
                                <DropdownMenuItem onClick={() => unassignProxy(workspace.id)}>
                                  <Unlink className="h-4 w-4 mr-2" />
                                  Remove Proxy
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteWorkspace(workspace.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        {/* Proxy Info - Most Important! */}
                        <div className={cn(
                          'mt-3 px-3 py-2 rounded-lg text-xs',
                          proxy ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/50'
                        )}>
                          {proxy ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Network className="h-3 w-3 text-green-500" />
                                <span className="font-medium text-green-400">Static IP</span>
                              </div>
                              <span className="font-mono text-green-300">{proxy.host}:{proxy.port}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              <span>No proxy assigned</span>
                            </div>
                          )}
                        </div>
                        
                        {/* ID and Account Info */}
                        <div className="mt-2 px-2 py-1 bg-muted/50 rounded text-xs font-mono">
                          <span className="text-muted-foreground">ID: </span>
                          <span className="text-primary">{workspace.id.slice(0, 8)}</span>
                          {workspace.accountEmail && (
                            <>
                              <span className="text-muted-foreground ml-2">•</span>
                              <span className="ml-1 text-accent">{workspace.accountEmail}</span>
                            </>
                          )}
                        </div>
                        
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="block text-[10px] uppercase tracking-wider">Created</span>
                            {new Date(workspace.createdAt).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase tracking-wider">Fingerprint</span>
                            <span className="font-mono text-accent">{workspace.fingerprintId?.slice(0, 8) || 'Generating...'}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
