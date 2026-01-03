/**
 * @fileoverview IPC Client
 * @module lib/ipc-client
 *
 * Type-safe wrapper for Electron IPC communication.
 */

import { IpcRendererEvent } from 'electron';

/**
 * IPC client for renderer process
 */
export const ipc = {
  /**
   * Invoke an IPC channel and wait for response
   */
  invoke: async <T = unknown>(channel: string, data?: unknown): Promise<T> => {
    if (typeof window !== 'undefined' && window.electron) {
      return await window.electron.invoke<T>(channel, data);
    }
    throw new Error('Electron IPC not available');
  },

  /**
   * Subscribe to an IPC channel
   */
  on: (
    channel: string,
    callback: (event: IpcRendererEvent, ...args: unknown[]) => void
  ): (() => void) => {
    if (typeof window !== 'undefined' && window.electron) {
      return window.electron.on(channel, callback);
    }
    return () => {};
  },
};

/**
 * Check if running in Electron
 */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electron;
}
