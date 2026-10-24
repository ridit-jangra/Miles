import { app, BrowserWindow, ipcMain, session } from "electron";
import { join } from "node:path";

import { lastLogLines, startServer, stopServer } from "./server";

type ServerStatus = {
  state: "starting" | "ready" | "error";
  text: string;
  steps?: { id: string; label: string; state: "pending" | "active" | "done"; fraction: number }[];
  log?: string;
};

let status: ServerStatus = { state: "starting", text: "Starting Miles…" };

function setStatus(next: ServerStatus): void {
  status = next;
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("server:status", next);
}

function createWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: "#0a0a0f",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
}

function loadApp(win: BrowserWindow): void {
  if (process.env["ELECTRON_RENDERER_URL"]) {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media");
  });

  ipcMain.handle("server:status", () => status);
  loadApp(createWindow());

  try {
    await startServer(
      join(app.getAppPath(), ".."),
      join(app.getPath("userData"), "server.log"),
      (update) => setStatus({ state: "starting", ...update }),
    );
    setStatus({ state: "ready", text: "" });
  } catch (error) {
    setStatus({ state: "error", text: `${(error as Error).message}\n\n${lastLogLines()}` });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) loadApp(createWindow());
  });
});

let stopping = false;
app.on("before-quit", (event) => {
  if (stopping) return;
  event.preventDefault();
  stopping = true;
  stopServer().finally(() => app.exit(0));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
