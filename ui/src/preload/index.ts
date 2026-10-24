import { contextBridge, ipcRenderer } from "electron";

export type ServerStatus = { state: "starting" | "ready" | "error"; text: string };

contextBridge.exposeInMainWorld("miles", {
  platform: process.platform,
  serverStatus: (): Promise<ServerStatus> => ipcRenderer.invoke("server:status"),
  onServerStatus: (callback: (status: ServerStatus) => void): (() => void) => {
    const handler = (_event: unknown, status: ServerStatus): void => callback(status);
    ipcRenderer.on("server:status", handler);
    return () => ipcRenderer.removeListener("server:status", handler);
  },
});
