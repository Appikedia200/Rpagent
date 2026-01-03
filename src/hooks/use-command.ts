/**
 * @fileoverview Command Hook
 * @module hooks/use-command
 *
 * Custom hook for command execution.
 */

'use client';

import { useState, useCallback } from 'react';
import { ipc, isElectron } from '../lib/ipc-client';
import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import { CommandResult, CommandResultType } from '@shared/types/command.types';

export function useCommand() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);

  const executeCommand = useCallback(async (command: string): Promise<CommandResult | null> => {
    if (!isElectron()) {
      return {
        type: CommandResultType.ERROR,
        message: 'Not running in Electron',
        timestamp: new Date().toISOString(),
      };
    }

    setLoading(true);
    try {
      const res = await ipc.invoke<CommandResult>(IPC_CHANNELS.COMMAND_EXECUTE, {
        raw: command,
        timestamp: new Date().toISOString(),
      });
      setResult(res);
      return res;
    } catch (err) {
      const errorResult: CommandResult = {
        type: CommandResultType.ERROR,
        message: err instanceof Error ? err.message : 'Command execution failed',
        timestamp: new Date().toISOString(),
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, []);

  return { executeCommand, loading, result };
}
