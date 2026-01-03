/**
 * @fileoverview Tasks Hook
 * @module hooks/use-tasks
 *
 * Custom hook for task management with real IPC communication.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ipc, isElectron } from '@/lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { Task, TaskProgress } from '@shared/types/task.types';

interface UseTasksReturn {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  loadTasks: () => Promise<void>;
  executeTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string) => Promise<boolean>;
  pauseTask: (taskId: string) => Promise<boolean>;
  resumeTask: (taskId: string) => Promise<boolean>;
  getRunningTasks: () => Promise<Task[]>;
}

export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!isElectron()) {
      setLoading(false);
      setError('Not running in Electron');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await ipc.invoke<Task[]>(IPC_CHANNELS.TASK_GET_ALL);
      setTasks(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const executeTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.TASK_EXECUTE, { taskId });
      await loadTasks();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute task');
      return false;
    }
  }, [loadTasks]);

  const cancelTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.TASK_CANCEL, { id: taskId });
      await loadTasks();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel task');
      return false;
    }
  }, [loadTasks]);

  const pauseTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.TASK_PAUSE, { id: taskId });
      await loadTasks();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause task');
      return false;
    }
  }, [loadTasks]);

  const resumeTask = useCallback(async (taskId: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.TASK_RESUME, { id: taskId });
      await loadTasks();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume task');
      return false;
    }
  }, [loadTasks]);

  const getRunningTasks = useCallback(async (): Promise<Task[]> => {
    if (!isElectron()) return [];
    try {
      return await ipc.invoke<Task[]>(IPC_CHANNELS.TASK_GET_RUNNING);
    } catch {
      return [];
    }
  }, []);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Subscribe to task progress events
  useEffect(() => {
    if (!isElectron()) return;

    const unsubProgress = ipc.on(IPC_CHANNELS.EVENT_TASK_PROGRESS, (_, ...args) => {
      const progress = args[0] as TaskProgress;
      setTasks(prev => prev.map(task => 
        task.id === progress.taskId 
          ? { ...task, progress: progress.progress, completedSteps: progress.completedSteps }
          : task
      ));
    });

    const unsubCompleted = ipc.on(IPC_CHANNELS.EVENT_TASK_COMPLETED, () => {
      loadTasks();
    });

    const unsubFailed = ipc.on(IPC_CHANNELS.EVENT_TASK_FAILED, () => {
      loadTasks();
    });

    return () => {
      unsubProgress();
      unsubCompleted();
      unsubFailed();
    };
  }, [loadTasks]);

  return {
    tasks,
    loading,
    error,
    loadTasks,
    executeTask,
    cancelTask,
    pauseTask,
    resumeTask,
    getRunningTasks,
  };
}

