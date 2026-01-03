/**
 * @fileoverview Workspaces Hook
 * @module hooks/use-workspaces
 *
 * Custom hook for workspace operations.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '../lib/store/workspace.store';
import { ipc, isElectron } from '../lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { Workspace, CreateWorkspaceInput } from '@shared/types/workspace.types';

export function useWorkspaces() {
  const { 
    workspaces, 
    loading, 
    error, 
    setWorkspaces, 
    addWorkspace,
    removeWorkspace,
    setLoading, 
    setError,
  } = useWorkspaceStore();

  const loadWorkspaces = useCallback(async () => {
    if (!isElectron()) return;
    
    setLoading(true);
    try {
      const data = await ipc.invoke<Workspace[]>(IPC_CHANNELS.WORKSPACE_GET_ALL);
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    }
  }, [setWorkspaces, setLoading, setError]);

  const createWorkspace = useCallback(async (input: CreateWorkspaceInput) => {
    if (!isElectron()) return null;
    
    try {
      const workspace = await ipc.invoke<Workspace>(IPC_CHANNELS.WORKSPACE_CREATE, input);
      addWorkspace(workspace);
      return workspace;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
      return null;
    }
  }, [addWorkspace, setError]);

  const deleteWorkspace = useCallback(async (id: string) => {
    if (!isElectron()) return false;
    
    try {
      await ipc.invoke(IPC_CHANNELS.WORKSPACE_DELETE, { id });
      removeWorkspace(id);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
      return false;
    }
  }, [removeWorkspace, setError]);

  const launchBrowser = useCallback(async (id: string) => {
    if (!isElectron()) return false;
    
    try {
      const result = await ipc.invoke<{ success: boolean; error?: string }>(
        IPC_CHANNELS.BROWSER_LAUNCH, 
        { workspaceId: id }
      );
      
      if (!result.success) {
        setError(result.error || 'Failed to launch browser');
        await loadWorkspaces(); // Refresh to show error status
        return false;
      }
      
      await loadWorkspaces(); // Refresh to get updated status
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch browser');
      await loadWorkspaces();
      return false;
    }
  }, [loadWorkspaces, setError]);

  const closeBrowser = useCallback(async (id: string) => {
    if (!isElectron()) return false;
    
    try {
      await ipc.invoke(IPC_CHANNELS.BROWSER_CLOSE, { workspaceId: id });
      await loadWorkspaces();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close browser');
      return false;
    }
  }, [loadWorkspaces, setError]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return {
    workspaces,
    loading,
    error,
    loadWorkspaces,
    createWorkspace,
    deleteWorkspace,
    launchBrowser,
    closeBrowser,
  };
}
