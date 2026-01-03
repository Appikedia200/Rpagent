/**
 * @fileoverview Workflows Hook
 * @module hooks/use-workflows
 *
 * Custom hook for workflow management with real IPC communication.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ipc, isElectron } from '@/lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { Workflow, CreateWorkflowInput } from '@shared/types/workflow.types';

interface UseWorkflowsReturn {
  workflows: Workflow[];
  loading: boolean;
  error: string | null;
  loadWorkflows: () => Promise<void>;
  createWorkflow: (input: CreateWorkflowInput) => Promise<Workflow | null>;
  deleteWorkflow: (id: string) => Promise<boolean>;
  runWorkflow: (workflowId: string) => Promise<boolean>;
}

export function useWorkflows(): UseWorkflowsReturn {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflows = useCallback(async () => {
    if (!isElectron()) {
      setLoading(false);
      setError('Not running in Electron');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await ipc.invoke<Workflow[]>(IPC_CHANNELS.WORKFLOW_GET_ALL);
      setWorkflows(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWorkflow = useCallback(async (input: CreateWorkflowInput): Promise<Workflow | null> => {
    if (!isElectron()) return null;
    try {
      const workflow = await ipc.invoke<Workflow>(IPC_CHANNELS.WORKFLOW_CREATE, input);
      await loadWorkflows();
      return workflow;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
      return null;
    }
  }, [loadWorkflows]);

  const deleteWorkflow = useCallback(async (id: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      await ipc.invoke(IPC_CHANNELS.WORKFLOW_DELETE, { id });
      await loadWorkflows();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
      return false;
    }
  }, [loadWorkflows]);

  const runWorkflow = useCallback(async (workflowId: string): Promise<boolean> => {
    if (!isElectron()) return false;
    try {
      // Create a task for this workflow and execute it
      const task = await ipc.invoke(IPC_CHANNELS.TASK_CREATE, {
        name: `Workflow Run - ${new Date().toISOString()}`,
        workflowId,
        workspaceIds: [],
      });
      if (task && typeof task === 'object' && 'id' in task) {
        await ipc.invoke(IPC_CHANNELS.TASK_EXECUTE, { taskId: (task as { id: string }).id });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run workflow');
      return false;
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  return {
    workflows,
    loading,
    error,
    loadWorkflows,
    createWorkflow,
    deleteWorkflow,
    runWorkflow,
  };
}


