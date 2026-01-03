/**
 * @fileoverview Task Store
 * @module lib/store/task
 *
 * Zustand store for task state management.
 */

import { create } from 'zustand';
import { Task, TaskProgress } from '@shared/types/task.types';

interface TaskState {
  tasks: Task[];
  activeProgress: Map<string, TaskProgress>;
  loading: boolean;
  error: string | null;
}

interface TaskActions {
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  removeTask: (id: string) => void;
  updateProgress: (progress: TaskProgress) => void;
  clearProgress: (taskId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useTaskStore = create<TaskState & TaskActions>((set) => ({
  tasks: [],
  activeProgress: new Map(),
  loading: false,
  error: null,

  setTasks: (tasks) => set({ tasks, loading: false }),
  
  addTask: (task) => set((state) => ({
    tasks: [task, ...state.tasks],
  })),
  
  updateTask: (id, data) => set((state) => ({
    tasks: state.tasks.map(t =>
      t.id === id ? { ...t, ...data } : t
    ),
  })),
  
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== id),
  })),
  
  updateProgress: (progress) => set((state) => {
    const newProgress = new Map(state.activeProgress);
    newProgress.set(progress.workspaceId, progress);
    return { activeProgress: newProgress };
  }),
  
  clearProgress: (taskId) => set((state) => {
    const newProgress = new Map(state.activeProgress);
    for (const [key, value] of newProgress.entries()) {
      if (value.taskId === taskId) {
        newProgress.delete(key);
      }
    }
    return { activeProgress: newProgress };
  }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error, loading: false }),
}));
