'use client';

import React, { memo, useState, useRef, useEffect, useCallback } from 'react';
import {
  Bell,
  Search,
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  X,
  Info,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSystemStats } from '@/hooks/use-system-stats';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface TopNavProps {
  sidebarCollapsed?: boolean;
}

// Memoized stat display
const StatDisplay = memo(function StatDisplay({
  icon: Icon,
  value,
  unit,
  warning,
}: {
  icon: React.ElementType;
  value: number;
  unit: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className={cn(warning ? 'text-destructive' : 'text-muted-foreground')}>
        {value.toFixed(0)}{unit}
      </span>
    </div>
  );
});

// Memoized notification icon
const NotificationIcon = memo(function NotificationIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-accent" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
});

// Memoized notification item
const NotificationItem = memo(function NotificationItem({
  notification,
  onClear,
}: {
  notification: Notification;
  onClear: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'p-3 hover:bg-secondary/50 flex items-start gap-3',
        !notification.read && 'bg-secondary/30'
      )}
    >
      <NotificationIcon type={notification.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{notification.title}</p>
        <p className="text-xs text-muted-foreground">{notification.message}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onClear(notification.id)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
});

function TopNavComponent({ sidebarCollapsed = false }: TopNavProps) {
  const { stats } = useSystemStats();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close notifications when clicking outside
  useEffect(() => {
    if (!showNotifications) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const toggleNotifications = useCallback(() => {
    setShowNotifications(prev => !prev);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 flex h-16 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-6',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search workspaces, tasks, proxies..."
          className="pl-9 bg-background/50"
        />
      </div>

      {/* System Stats */}
      <div className="hidden lg:flex items-center gap-4">
        <StatDisplay icon={Cpu} value={stats.cpuUsage} unit="%" warning={stats.cpuUsage > 80} />
        <StatDisplay icon={HardDrive} value={stats.memoryUsage} unit="%" warning={stats.memoryUsage > 80} />
        <StatDisplay icon={Wifi} value={stats.networkUsage} unit=" KB/s" />
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1.5">
          <Activity className="h-3 w-3 text-accent" />
          <span>{stats.activeBrowsers} Active</span>
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <span>{stats.runningTasks} Tasks</span>
        </Badge>
      </div>

      {/* Notifications */}
      <div className="relative" ref={notificationRef}>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={toggleNotifications}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
        
        {/* Notification Panel */}
        {showNotifications && (
          <Card className="absolute right-0 top-full mt-2 w-80 shadow-lg z-50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Notifications</CardTitle>
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  Mark all read
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-64">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications</p>
                    <p className="text-xs text-muted-foreground">You&apos;re all caught up</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClear={clearNotification}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </header>
  );
}

export const TopNav = memo(TopNavComponent);
