'use client';

import * as React from 'react';
import {
  ListTodo,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Loader2,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useTasks } from '@/hooks/use-tasks';
import { TaskStatus } from '@shared/types/task.types';
import { isElectron, ipc } from '@/lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';

export default function TasksPage() {
  const { tasks, loading, error, loadTasks, executeTask, cancelTask, pauseTask, resumeTask } = useTasks();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<TaskStatus | 'all'>('all');
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExecute = async (taskId: string) => {
    setActionLoading(taskId);
    await executeTask(taskId);
    setActionLoading(null);
  };

  const handleCancel = async (taskId: string) => {
    setActionLoading(taskId);
    await cancelTask(taskId);
    setActionLoading(null);
  };

  const handlePause = async (taskId: string) => {
    setActionLoading(taskId);
    await pauseTask(taskId);
    setActionLoading(null);
  };

  const handleResume = async (taskId: string) => {
    setActionLoading(taskId);
    await resumeTask(taskId);
    setActionLoading(null);
  };

  const handleClearCompleted = async () => {
    if (isElectron()) {
      await ipc.invoke(IPC_CHANNELS.TASK_CLEAR_COMPLETED);
      loadTasks();
    }
  };

  const handleClearAll = async () => {
    if (isElectron()) {
      await ipc.invoke(IPC_CHANNELS.TASK_CLEAR_ALL);
      loadTasks();
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case TaskStatus.RUNNING:
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case TaskStatus.COMPLETED:
        return <CheckCircle2 className="h-4 w-4 text-accent" />;
      case TaskStatus.FAILED:
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case TaskStatus.CANCELLED:
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case TaskStatus.PAUSED:
        return <Pause className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING:
        return <Badge variant="secondary">Pending</Badge>;
      case TaskStatus.RUNNING:
        return <Badge variant="default">Running</Badge>;
      case TaskStatus.COMPLETED:
        return <Badge variant="success">Completed</Badge>;
      case TaskStatus.FAILED:
        return <Badge variant="destructive">Failed</Badge>;
      case TaskStatus.CANCELLED:
        return <Badge variant="outline">Cancelled</Badge>;
      case TaskStatus.PAUSED:
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Paused</Badge>;
      default:
        return null;
    }
  };

  const runningCount = tasks.filter((t) => t.status === TaskStatus.RUNNING).length;
  const completedCount = tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
  const failedCount = tasks.filter((t) => t.status === TaskStatus.FAILED).length;
  const pendingCount = tasks.filter((t) => t.status === TaskStatus.PENDING).length;

  // Show warning if not in Electron
  if (!isElectron()) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground">
              Monitor and manage automation task execution
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
                  Tasks require the Electron desktop application. Please run the app via `npm run dev` and access it through the Electron window, not the browser directly.
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
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            Monitor and manage automation task execution
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClearCompleted}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Completed
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearAll}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
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
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className={cn("h-4 w-4 text-primary", runningCount > 0 && "animate-spin")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>All Tasks</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button 
                variant={statusFilter === 'all' ? 'secondary' : 'outline'} 
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button 
                variant={statusFilter === TaskStatus.RUNNING ? 'secondary' : 'outline'} 
                size="sm"
                onClick={() => setStatusFilter(TaskStatus.RUNNING)}
              >
                Running
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={loadTasks}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {loading && tasks.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No tasks found</h3>
                <p className="text-sm text-muted-foreground">
                  {tasks.length === 0 
                    ? 'Create a new task from the Command Center' 
                    : 'Try a different search or filter'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map((task) => (
                  <Card key={task.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            'bg-gradient-to-br from-secondary to-secondary/50'
                          )}>
                            {getStatusIcon(task.status)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{task.name}</p>
                              {getStatusBadge(task.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {task.completedSteps || 0} / {task.totalSteps || 0} steps completed
                            </p>
                            {task.error && (
                              <p className="text-sm text-destructive mt-1">{task.error}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {actionLoading === task.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              {task.status === TaskStatus.RUNNING && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handlePause(task.id)}
                                  >
                                    <Pause className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handleCancel(task.id)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {task.status === TaskStatus.PAUSED && (
                                <>
                                  <Button 
                                    size="sm"
                                    onClick={() => handleResume(task.id)}
                                  >
                                    <Play className="h-4 w-4 mr-2" />
                                    Resume
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    className="h-8 w-8"
                                    onClick={() => handleCancel(task.id)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {task.status === TaskStatus.PENDING && (
                                <Button 
                                  size="sm"
                                  onClick={() => handleExecute(task.id)}
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Start
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {task.status === TaskStatus.RUNNING && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{task.progress || 0}%</span>
                          </div>
                          <Progress value={task.progress || 0} className="h-2" />
                        </div>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                        {task.startedAt && (
                          <span>Started: {new Date(task.startedAt).toLocaleString()}</span>
                        )}
                        {task.completedAt && (
                          <span>Completed: {new Date(task.completedAt).toLocaleString()}</span>
                        )}
                        {!task.startedAt && task.createdAt && (
                          <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
                        )}
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
