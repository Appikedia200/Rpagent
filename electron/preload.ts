/**
 * @fileoverview Electron Preload Script
 * @module electron/preload
 *
 * Sets up the context bridge for secure IPC communication
 * between the main process and renderer process.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

/**
 * Electron API exposed to renderer process
 */
const electronAPI = {
  /**
   * Invoke an IPC channel and wait for response
   */
  invoke: <T>(channel: string, data?: unknown): Promise<T> => {
    return ipcRenderer.invoke(channel, data);
  },

  /**
   * Subscribe to an IPC channel
   */
  on: (
    channel: string,
    callback: (event: IpcRendererEvent, ...args: unknown[]) => void
  ): (() => void) => {
    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => {
      callback(_event, ...args);
    };
    ipcRenderer.on(channel, subscription);
    
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },

  /**
   * Subscribe to an IPC channel once
   */
  once: (
    channel: string,
    callback: (event: IpcRendererEvent, ...args: unknown[]) => void
  ): void => {
    ipcRenderer.once(channel, callback);
  },

  /**
   * Remove all listeners for a channel
   */
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },
};

// Expose API to renderer process
contextBridge.exposeInMainWorld('electron', electronAPI);

// Type declaration for renderer process
declare global {
  interface Window {
    electron: typeof electronAPI;
  }
}
