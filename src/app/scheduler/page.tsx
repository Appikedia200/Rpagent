'use client';

import * as React from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  MoreVertical,
  Timer,
  Repeat,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ScheduledTask {
  id: string;
  name: string;
  command: string;
  scheduleType: 'once' | 'interval' | 'daily' | 'weekly' | 'cron';
  scheduleValue: string;
  enabled: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  createdAt: string;
}

export default function SchedulerPage() {
  const [tasks, setTasks] = React.useState<ScheduledTask[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [newTask, setNewTask] = React.useState({
    name: '',
    command: '',
    scheduleType: 'daily' as ScheduledTask['scheduleType'],
    scheduleValue: '',
    hour: '09',
    minute: '00',
    dayOfWeek: '0',
    intervalValue: '1',
    intervalUnit: 'hours',
  });

  // Load tasks from backend on mount
  React.useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const result = await window.electron?.invoke<ScheduledTask[]>('scheduler:getAll');
      setTasks(result || []);
    } catch (error) {
      console.error('Failed to load scheduled tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSchedule = (task: ScheduledTask): string => {
    switch (task.scheduleType) {
      case 'once':
        return `Once at ${new Date(task.scheduleValue).toLocaleString()}`;
      case 'interval':
        return `Every ${task.scheduleValue}`;
      case 'daily':
        return `Daily at ${task.scheduleValue}`;
      case 'weekly':
        return `${task.scheduleValue}`;
      case 'cron':
        return `Cron: ${task.scheduleValue}`;
      default:
        return task.scheduleValue;
    }
  };

  const getStatusBadge = (status: ScheduledTask['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">Pending</Badge>;
      case 'running':
        return <Badge className="bg-green-500/20 text-green-400">Running</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'paused':
        return <Badge variant="outline">Paused</Badge>;
    }
  };

  const toggleTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      if (task.enabled) {
        await window.electron?.invoke('scheduler:pause', taskId);
      } else {
        await window.electron?.invoke('scheduler:resume', taskId);
      }
      await loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await window.electron?.invoke('scheduler:cancel', taskId);
      await loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const runNow = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Update UI to show running
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'running' as const } : t
    ));

    try {
      // Execute the command directly
      await window.electron?.invoke('command:execute', task.command);
      
      // Reload tasks to get updated state
      await loadTasks();
    } catch (error) {
      console.error('Failed to run task:', error);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'failed' as const } : t
      ));
    }
  };

  const handleCreate = async () => {
    let scheduleConfig: Record<string, unknown> = {};
    
    switch (newTask.scheduleType) {
      case 'daily':
        scheduleConfig = {
          type: 'daily',
          timeOfDay: { hour: parseInt(newTask.hour), minute: parseInt(newTask.minute) }
        };
        break;
      case 'weekly':
        scheduleConfig = {
          type: 'weekly',
          dayOfWeek: parseInt(newTask.dayOfWeek),
          timeOfDay: { hour: parseInt(newTask.hour), minute: parseInt(newTask.minute) }
        };
        break;
      case 'interval':
        const msMultipliers: Record<string, number> = {
          minutes: 60 * 1000,
          hours: 60 * 60 * 1000,
          days: 24 * 60 * 60 * 1000,
        };
        scheduleConfig = {
          type: 'interval',
          intervalMs: parseInt(newTask.intervalValue) * msMultipliers[newTask.intervalUnit]
        };
        break;
      case 'once':
        scheduleConfig = {
          type: 'once',
          runAt: newTask.scheduleValue
        };
        break;
      case 'cron':
        scheduleConfig = {
          type: 'cron',
          cronExpression: newTask.scheduleValue
        };
        break;
    }

    try {
      await window.electron?.invoke('scheduler:create', {
        name: newTask.name,
        command: newTask.command,
        schedule: scheduleConfig,
        enabled: true,
      });

      setCreateDialogOpen(false);
      setNewTask({
        name: '',
        command: '',
        scheduleType: 'daily',
        scheduleValue: '',
        hour: '09',
        minute: '00',
        dayOfWeek: '0',
        intervalValue: '1',
        intervalUnit: 'hours',
      });
      
      await loadTasks();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const activeCount = tasks.filter(t => t.enabled).length;
  const runningCount = tasks.filter(t => t.status === 'running').length;
  const totalRuns = tasks.reduce((sum, t) => sum + t.runCount, 0);

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Scheduler</h1>
          <p className="text-muted-foreground">Schedule automated tasks to run at specific times</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule New Task</DialogTitle>
              <DialogDescription>
                Create a new scheduled automation task
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Task Name</Label>
                <Input
                  placeholder="Daily Gmail Farming"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Command</Label>
                <Textarea
                  placeholder="Launch 10 browsers and create Gmail accounts"
                  value={newTask.command}
                  onChange={(e) => setNewTask({ ...newTask, command: e.target.value })}
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground">
                  This command will be executed when the schedule triggers
                </p>
              </div>
              <div className="space-y-2">
                <Label>Schedule Type</Label>
                <Select
                  value={newTask.scheduleType}
                  onValueChange={(v) => setNewTask({ ...newTask, scheduleType: v as ScheduledTask['scheduleType'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interval">⏱️ Interval (Every X hours/minutes)</SelectItem>
                    <SelectItem value="daily">📅 Daily (At specific time)</SelectItem>
                    <SelectItem value="weekly">📆 Weekly (Specific day & time)</SelectItem>
                    <SelectItem value="once">🎯 Once (Specific date & time)</SelectItem>
                    <SelectItem value="cron">⚙️ Cron Expression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Interval options */}
              {newTask.scheduleType === 'interval' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Every</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newTask.intervalValue}
                      onChange={(e) => setNewTask({ ...newTask, intervalValue: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select
                      value={newTask.intervalUnit}
                      onValueChange={(v) => setNewTask({ ...newTask, intervalUnit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Daily/Weekly time options */}
              {(newTask.scheduleType === 'daily' || newTask.scheduleType === 'weekly') && (
                <>
                  {newTask.scheduleType === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Day of Week</Label>
                      <Select
                        value={newTask.dayOfWeek}
                        onValueChange={(v) => setNewTask({ ...newTask, dayOfWeek: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hour</Label>
                      <Select
                        value={newTask.hour}
                        onValueChange={(v) => setNewTask({ ...newTask, hour: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}:00
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Minute</Label>
                      <Select
                        value={newTask.minute}
                        onValueChange={(v) => setNewTask({ ...newTask, minute: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['00', '15', '30', '45'].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {/* Once - datetime picker */}
              {newTask.scheduleType === 'once' && (
                <div className="space-y-2">
                  <Label>Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={newTask.scheduleValue}
                    onChange={(e) => setNewTask({ ...newTask, scheduleValue: e.target.value })}
                  />
                </div>
              )}

              {/* Cron expression */}
              {newTask.scheduleType === 'cron' && (
                <div className="space-y-2">
                  <Label>Cron Expression</Label>
                  <Input
                    placeholder="0 9 * * 1-5"
                    value={newTask.scheduleValue}
                    onChange={(e) => setNewTask({ ...newTask, scheduleValue: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: minute hour day-of-month month day-of-week
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newTask.name || !newTask.command}>
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Timer className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running Now</CardTitle>
            <Repeat className={cn("h-4 w-4 text-green-500", runningCount > 0 && "animate-spin")} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{runningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRuns}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scheduled Tasks</CardTitle>
            <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No scheduled tasks</h3>
                <p className="text-sm text-muted-foreground">
                  Create a new scheduled task to get started
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map((task) => (
                  <Card key={task.id} className={cn(
                    'relative transition-all',
                    !task.enabled && 'opacity-60'
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className={cn(
                            'flex h-12 w-12 items-center justify-center rounded-lg',
                            task.status === 'running' 
                              ? 'bg-green-500/20' 
                              : task.enabled 
                                ? 'bg-accent/20'
                                : 'bg-secondary'
                          )}>
                            {task.status === 'running' ? (
                              <Loader2 className="h-6 w-6 text-green-500 animate-spin" />
                            ) : (
                              <Clock className={cn(
                                'h-6 w-6',
                                task.enabled ? 'text-accent' : 'text-muted-foreground'
                              )} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium">{task.name}</h3>
                              {getStatusBadge(task.status)}
                              <Badge variant="outline" className="text-xs">
                                {formatSchedule(task)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {task.command}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {task.lastRun && (
                                <span>Last run: {new Date(task.lastRun).toLocaleString()}</span>
                              )}
                              {task.nextRun && task.enabled && (
                                <span className="text-accent">
                                  Next: {new Date(task.nextRun).toLocaleString()}
                                </span>
                              )}
                              <span>Runs: {task.runCount}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleTask(task.id)}
                            title={task.enabled ? 'Pause' : 'Resume'}
                          >
                            {task.enabled ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => runNow(task.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Run Now
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleTask(task.id)}>
                                {task.enabled ? (
                                  <>
                                    <Pause className="h-4 w-4 mr-2" />
                                    Pause
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Resume
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteTask(task.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
