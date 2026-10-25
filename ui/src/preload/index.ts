import { contextBridge, ipcRenderer } from "electron";

export type ServerStatus = {
  state: "starting" | "ready" | "error";
  text: string;
  steps?: { id: string; label: string; state: "pending" | "active" | "done"; fraction: number }[];
  log?: string;
  title?: string;
  intro?: string;
  notice?: string;
  review?: { name: string; state: "new" | "changed"; description: string; permissions: string[]; dependencies: string[]; servers: { name: string; run: string }[]; selected?: boolean }[];
};

contextBridge.exposeInMainWorld("miles", {
  platform: process.platform,
  serverStatus: (): Promise<ServerStatus> => ipcRenderer.invoke("server:status"),
  review: (decision: { approve: string[] }): Promise<void> => ipcRenderer.invoke("server:review", decision),
  acknowledge: (): Promise<void> => ipcRenderer.invoke("server:ack"),
  onServerStatus: (callback: (status: ServerStatus) => void): (() => void) => {
    const handler = (_event: unknown, status: ServerStatus): void => callback(status);
    ipcRenderer.on("server:status", handler);
    return () => ipcRenderer.removeListener("server:status", handler);
  },
});
