'use client';

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Terminal,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Clock,
  Zap,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCommand } from '@/hooks/use-command';
import { useSystemStats } from '@/hooks/use-system-stats';
import { CommandResult, CommandResultType } from '@shared/types/command.types';
import { ipc, isElectron } from '@/lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';

interface CommandHistoryItem {
  id: string;
  command: string;
  result: CommandResult;
}

const quickCommands = [
  { label: 'Launch 10 browsers', command: 'launch 10 browsers and go to google.com' },
  { label: 'Test proxies', command: 'test all proxies and report status' },
  { label: 'Create workspace', command: 'create workspace "Test Automation"' },
  { label: 'Run login task', command: 'login to example.com with data from users.csv' },
];

// Memoized stat card component
const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor,
  gradient,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  iconColor?: string;
  gradient?: string;
}) {
  return (
    <Card className={gradient}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', iconColor || 'text-muted-foreground')} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
});

// Memoized history item
const HistoryItem = memo(function HistoryItem({ item }: { item: CommandHistoryItem }) {
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-accent" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'info':
        return <Info className="h-4 w-4 text-primary" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-start gap-2">
        {getResultIcon(item.result.type)}
        <p className="text-xs font-mono flex-1 break-all">
          {item.command}
        </p>
      </div>
      <p className="text-xs text-muted-foreground pl-6">
        {item.result.message}
      </p>
      <p className="text-[10px] text-muted-foreground pl-6">
        {new Date(item.result.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
});

// Memoized quick command button
const QuickCommandButton = memo(function QuickCommandButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="text-xs"
    >
      {label}
      <ArrowRight className="h-3 w-3 ml-1" />
    </Button>
  );
});

function CommandCenter() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);
  const { executeCommand, loading } = useCommand();
  const { stats } = useSystemStats();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    if (isElectron()) {
      ipc.invoke<Array<{
        id: string;
        command: string;
        resultType: string;
        resultMessage: string;
        createdAt: string;
      }>>(IPC_CHANNELS.COMMAND_GET_HISTORY, { limit: 50 })
        .then((entries) => {
          const historyItems: CommandHistoryItem[] = entries.map(e => ({
            id: e.id,
            command: e.command,
            result: {
              type: e.resultType as CommandResultType,
              message: e.resultMessage,
              timestamp: e.createdAt,
            },
          }));
          setHistory(historyItems.reverse()); // Oldest first for display
        })
        .catch(err => console.error('Failed to load history:', err));
    }
  }, []);

  // Clear history function
  const clearHistory = useCallback(async () => {
    if (isElectron()) {
      await ipc.invoke(IPC_CHANNELS.COMMAND_CLEAR_HISTORY);
      setHistory([]);
    } else {
      setHistory([]);
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || loading) return;

    const result = await executeCommand(command);
    if (result) {
      setHistory((prev) => [
        ...prev,
        { id: crypto.randomUUID(), command, result },
      ]);
      setCommand('');
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [command, loading, executeCommand]);

  const handleQuickCommand = useCallback(async (cmd: string) => {
    setCommand(cmd);
    const result = await executeCommand(cmd);
    if (result) {
      setHistory((prev) => [
        ...prev,
        { id: crypto.randomUUID(), command: cmd, result },
      ]);
      setCommand('');
    }
  }, [executeCommand]);

  const handleCommandChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommand(e.target.value);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">
            Execute browser automation tasks with natural language commands
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1.5">
            <div className="h-2 w-2 rounded-full bg-accent" />
            System Ready
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Browsers"
          value={stats.activeBrowsers}
          subtitle={`of ${stats.totalWorkspaces} workspaces`}
          icon={Terminal}
          iconColor="text-primary"
          gradient="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20"
        />
        <StatCard
          title="Running Tasks"
          value={stats.runningTasks}
          subtitle="Executing now"
          icon={Zap}
          iconColor="text-accent"
          gradient="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Proxy Health</CardTitle>
            <div className={cn(
              'h-4 w-4 rounded-full',
              stats.proxyHealth > 80 ? 'bg-accent' : 
              stats.proxyHealth > 50 ? 'bg-yellow-500' : 'bg-destructive'
            )} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.proxyHealth}%</div>
            <p className="text-xs text-muted-foreground">Connectivity status</p>
          </CardContent>
        </Card>
        <StatCard
          title="CPU Usage"
          value={`${stats.cpuUsage.toFixed(0)}%`}
          subtitle="System load"
          icon={Clock}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Command Input */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Command Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                placeholder="Enter your automation command...&#10;&#10;Examples:&#10;• Launch 50 browsers and navigate to google.com&#10;• Login to twitter.com using accounts from data.csv&#10;• Fill form on example.com with random data"
                value={command}
                onChange={handleCommandChange}
                className="min-h-[150px] font-mono text-sm resize-none"
                disabled={loading}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Press Enter to execute or use quick commands
                </p>
                <Button type="submit" disabled={!command.trim() || loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Execute
                </Button>
              </div>
            </form>

            {/* Quick Commands */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Quick Commands</p>
              <div className="flex flex-wrap gap-2">
                {quickCommands.map((qc) => (
                  <QuickCommandButton
                    key={qc.label}
                    label={qc.label}
                    onClick={() => handleQuickCommand(qc.command)}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Command History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Command History</CardTitle>
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearHistory}>
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Terminal className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No commands executed yet</p>
                  <p className="text-xs">Your command history will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <HistoryItem key={item.id} item={item} />
                  ))}
                  <div ref={scrollRef} />
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default memo(CommandCenter);
