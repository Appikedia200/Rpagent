/**
 * @fileoverview Workspace Store
 * @module lib/store/workspace
 *
 * Zustand store for workspace state management.
 */

import { create } from 'zustand';
import { Workspace } from '@shared/types/workspace.types';

interface WorkspaceState {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  selectedId: string | null;
}

interface WorkspaceActions {
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, data: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set) => ({
  workspaces: [],
  loading: false,
  error: null,
  selectedId: null,

  setWorkspaces: (workspaces) => set({ workspaces, loading: false }),
  
  addWorkspace: (workspace) => set((state) => ({
    workspaces: [workspace, ...state.workspaces],
  })),
  
  updateWorkspace: (id, data) => set((state) => ({
    workspaces: state.workspaces.map(w =>
      w.id === id ? { ...w, ...data } : w
    ),
  })),
  
  removeWorkspace: (id) => set((state) => ({
    workspaces: state.workspaces.filter(w => w.id !== id),
  })),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error, loading: false }),
  
  setSelectedId: (selectedId) => set({ selectedId }),
}));
