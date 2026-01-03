'use client';

import * as React from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  activeBrowsers: number;
  runningTasks: number;
  networkSpeed: number;
  uptime: number;
}

interface BrowserMetric {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  cpu: number;
  memory: number;
  url: string;
  lastActivity: string;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export default function MonitoringPage() {
  const [metrics, setMetrics] = React.useState<SystemMetrics | null>(null);
  const [browserMetrics, setBrowserMetrics] = React.useState<BrowserMetric[]>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadMetrics = React.useCallback(async () => {
    try {
      // Get system stats
      const stats = await window.electron?.invoke<{
        cpu: number;
        memory: number;
        activeBrowsers: number;
        runningTasks: number;
        network: { uploadSpeed: number; downloadSpeed: number };
      }>('system:stats');
      
      if (stats) {
        const totalMemory = 16 * 1024 * 1024 * 1024; // Assume 16GB, we'll get actual from backend
        const usedMemory = (stats.memory / 100) * totalMemory;
        
        setMetrics({
          cpu: stats.cpu,
          memory: {
            used: usedMemory,
            total: totalMemory,
            percentage: stats.memory,
          },
          activeBrowsers: stats.activeBrowsers,
          runningTasks: stats.runningTasks,
          networkSpeed: stats.network?.downloadSpeed || 0,
          uptime: Date.now(), // We'll calculate from process start
        });
      }

      // Try to get browser metrics
      try {
        const browsers = await window.electron?.invoke<BrowserMetric[]>('monitoring:getBrowserMetrics');
        if (browsers) {
          setBrowserMetrics(browsers);
        }
      } catch {
        // If monitoring handler not available, use empty array
        setBrowserMetrics([]);
      }

      // Try to get alerts
      try {
        const alertsData = await window.electron?.invoke<Alert[]>('monitoring:getAlerts');
        if (alertsData) {
          setAlerts(alertsData);
        }
      } catch {
        // If monitoring handler not available, use empty array
        setAlerts([]);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadMetrics();
    
    // Refresh every 5 seconds
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMetrics();
  };

  const clearAlert = async (alertId: string) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
    try {
      await window.electron?.invoke('monitoring:clearAlert', alertId);
    } catch {
      // Ignore if handler not available
    }
  };

  const clearAllAlerts = async () => {
    setAlerts([]);
    try {
      await window.electron?.invoke('monitoring:clearAllAlerts');
    } catch {
      // Ignore if handler not available
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const formatUptime = (startTime: number) => {
    const diff = Date.now() - startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: BrowserMetric['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400">Active</Badge>;
      case 'idle':
        return <Badge variant="secondary">Idle</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground">Real-time performance metrics and alerts</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.cpu?.toFixed(1) || 0}%</div>
            <Progress 
              value={metrics?.cpu || 0} 
              className={cn(
                'mt-2',
                (metrics?.cpu || 0) > 80 && '[&>div]:bg-destructive'
              )}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {(metrics?.cpu || 0) > 80 ? '⚠️ High usage' : 'Normal'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.memory?.percentage?.toFixed(1) || 0}%</div>
            <Progress 
              value={metrics?.memory?.percentage || 0} 
              className={cn(
                'mt-2',
                (metrics?.memory?.percentage || 0) > 80 && '[&>div]:bg-destructive'
              )}
            />
            <p className="text-xs text-muted-foreground mt-2">
              {formatBytes(metrics?.memory?.used || 0)} / {formatBytes(metrics?.memory?.total || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Browsers</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeBrowsers || 0}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn(
                'h-2 w-2 rounded-full',
                (metrics?.activeBrowsers || 0) > 0 ? 'bg-green-500' : 'bg-gray-500'
              )} />
              <span className="text-xs text-muted-foreground">
                {(metrics?.runningTasks || 0)} tasks running
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Network</CardTitle>
            {(metrics?.networkSpeed || 0) > 0 ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((metrics?.networkSpeed || 0) / 1024).toFixed(1)} KB/s
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <Clock className="h-3 w-3 inline mr-1" />
              Uptime: {formatUptime(metrics?.uptime || Date.now())}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Browser Metrics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Browser Instances</CardTitle>
              <Badge variant="outline">{browserMetrics.length} active</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {browserMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <Globe className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No active browsers</p>
                  <p className="text-sm text-muted-foreground">
                    Launch browsers to see metrics here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {browserMetrics.map((browser) => (
                    <Card key={browser.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{browser.name}</span>
                              {getStatusBadge(browser.status)}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {browser.url || 'No page loaded'}
                            </p>
                          </div>
                          <div className="text-right text-xs">
                            <div className="flex items-center gap-1">
                              <Cpu className="h-3 w-3" />
                              <span>{browser.cpu}%</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <HardDrive className="h-3 w-3" />
                              <span>{browser.memory} MB</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Progress value={browser.cpu} className="flex-1 h-1" />
                          <Progress value={Math.min(browser.memory / 10, 100)} className="flex-1 h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Alerts
              </CardTitle>
              {alerts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAllAlerts}>
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-500/50 mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                  <p className="text-sm text-muted-foreground">
                    System is running smoothly
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <Card key={alert.id} className={cn(
                      'relative',
                      alert.type === 'error' && 'border-destructive/50',
                      alert.type === 'warning' && 'border-yellow-500/50'
                    )}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {getAlertIcon(alert.type)}
                            <div>
                              <p className="text-sm">{alert.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(alert.timestamp).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => clearAlert(alert.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
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

      {/* Real-time Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Live Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>System Online</span>
            </div>
            <span>•</span>
            <span>{metrics?.activeBrowsers || 0} browsers active</span>
            <span>•</span>
            <span>{metrics?.runningTasks || 0} tasks running</span>
            <span>•</span>
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
