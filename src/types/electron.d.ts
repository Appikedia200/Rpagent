import { IpcRendererEvent } from 'electron';

declare global {
  interface Window {
    electron: {
      invoke: <T = unknown>(channel: string, data?: unknown) => Promise<T>;
      on: (
        channel: string,
        callback: (event: IpcRendererEvent, ...args: unknown[]) => void
      ) => () => void;
      off: (
        channel: string,
        callback: (event: IpcRendererEvent, ...args: unknown[]) => void
      ) => void;
    };
  }
}

export {};

