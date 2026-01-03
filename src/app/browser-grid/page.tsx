'use client';

import * as React from 'react';
import {
  Grid3X3,
  Pause,
  RefreshCw,
  Search,
  Loader2,
  Globe,
  AlertCircle,
  XCircle,
  MoreVertical,
  MonitorOff,
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
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useBrowsers, BrowserSession } from '@/hooks/use-browsers';
import { isElectron } from '@/lib/ipc-client';

export default function BrowserGridPage() {
  const { 
    sessions, 
    loading, 
    error, 
    loadSessions, 
    closeBrowser, 
    closeAllBrowsers,
    takeScreenshot,
  } = useBrowsers();
  const [search, setSearch] = React.useState('');
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [closingAll, setClosingAll] = React.useState(false);

  const filteredSessions = sessions.filter((session) =>
    session.workspaceName.toLowerCase().includes(search.toLowerCase()) ||
    session.url.toLowerCase().includes(search.toLowerCase())
  );

  const handleClose = async (workspaceId: string) => {
    setActionLoading(workspaceId);
    await closeBrowser(workspaceId);
    setActionLoading(null);
  };

  const handleCloseAll = async () => {
    setClosingAll(true);
    await closeAllBrowsers();
    setClosingAll(false);
  };

  const handleScreenshot = async (workspaceId: string) => {
    setActionLoading(workspaceId);
    await takeScreenshot(workspaceId);
    setActionLoading(null);
  };

  const getStatusBadge = (status: BrowserSession['status']) => {
    switch (status) {
      case 'running':
        return <Badge variant="success">Running</Badge>;
      case 'idle':
        return <Badge variant="secondary">Idle</Badge>;
      case 'paused':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Paused</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const runningCount = sessions.filter(s => s.status === 'running').length;
  const idleCount = sessions.filter(s => s.status === 'idle').length;
  const pausedCount = sessions.filter(s => s.status === 'paused').length;
  const errorCount = sessions.filter(s => s.status === 'error').length;

  // Show warning if not in Electron
  if (!isElectron()) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Browser Grid</h1>
            <p className="text-muted-foreground">
              Monitor and control active browser sessions
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
                  Browser Grid requires the Electron desktop application. Please run the app via `npm run dev` and access it through the Electron window.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Browser Grid</h1>
          <p className="text-muted-foreground">
            Monitor and control active browser sessions
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleCloseAll}
            disabled={closingAll || sessions.length === 0}
          >
            {closingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MonitorOff className="h-4 w-4 mr-2" />
            )}
            Close All
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

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className={cn("h-4 w-4 text-accent", runningCount > 0 && "animate-spin")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Idle</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{idleCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
            <Pause className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pausedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{errorCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Browser Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Sessions</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={loadSessions} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            {loading && sessions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Grid3X3 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No active browser sessions</h3>
                <p className="text-sm text-muted-foreground">
                  Launch browsers from the Command Center to see them here
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredSessions.map((session) => (
                  <Card key={session.workspaceId} className="relative overflow-hidden">
                    {/* Browser Preview Area */}
                    <div className="aspect-video bg-gradient-to-br from-secondary to-secondary/50 relative">
                      {session.screenshot ? (
                        <img 
                          src={session.screenshot} 
                          alt="Browser preview" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Globe className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          session.status === 'running' ? 'bg-accent animate-pulse' :
                          session.status === 'error' ? 'bg-destructive' :
                          session.status === 'paused' ? 'bg-yellow-500' :
                          'bg-muted-foreground'
                        )} />
                      </div>
                      <div className="absolute top-2 right-2">
                        {getStatusBadge(session.status)}
                      </div>
                    </div>
                    
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{session.workspaceName}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {session.url || 'about:blank'}
                          </p>
                          {session.currentTask && (
                            <p className="text-xs text-primary truncate mt-1">
                              {session.currentTask}
                            </p>
                          )}
                        </div>
                        {actionLoading === session.workspaceId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleScreenshot(session.workspaceId)}>
                                Take Screenshot
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => handleClose(session.workspaceId)}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Close Browser
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>CPU: {session.cpu}%</span>
                        <span>RAM: {session.memory}MB</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
