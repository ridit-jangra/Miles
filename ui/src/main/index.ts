import { app, BrowserWindow, ipcMain, session } from "electron";
import { join } from "node:path";

import { installLauncher } from "./desktop";
import { ensureInstalled, installed, type InstallUI } from "./install";
import { serverRoot } from "./paths";
import { type BootStep, lastLogLines, sendToServer, startServer, stopServer } from "./server";

type ServerStatus = {
  state: "starting" | "ready" | "error";
  text: string;
  steps?: { id: string; label: string; state: "pending" | "active" | "done"; fraction: number }[];
  log?: string;
  title?: string;
  intro?: string;
  review?: { name: string; state: "new" | "changed"; description: string; permissions: string[]; dependencies: string[]; servers: { name: string; run: string }[]; selected?: boolean }[];
};

let status: ServerStatus = { state: "starting", text: "Starting Miles…" };

function setStatus(next: ServerStatus): void {
  status = next;
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("server:status", next);
}

const installSteps = new Map<string, BootStep>();
let waiting: ((names: string[]) => void) | null = null;

function installUi(installLog: string[]): InstallUI {
  const title = "Installing Miles";
  return {
    step(id, label, state, fraction = 0) {
      installSteps.set(id, { id, label, state, fraction });
      setStatus({ ...status, state: "starting", text: "", title, steps: [...installSteps.values()] });
    },
    log(line) {
      installLog.push(line);
      setStatus({ ...status, log: line });
    },
    ask(items) {
      return new Promise((resolve) => {
        waiting = resolve;
        setStatus({
          ...status,
          text: "",
          title,
          intro: "Miles needs a few tools to set itself up. Pick what it may install.",
          review: items,
        });
      });
    },
  };
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

  try {
    installLauncher();
  } catch (error) {
    console.error("Couldn't add Miles to the app menu:", error);
  }

  ipcMain.handle("server:status", () => status);
  ipcMain.handle("server:review", (_event, decision: { approve: string[] }) => {
    if (waiting) {
      waiting(decision.approve);
      waiting = null;
    } else {
      sendToServer(decision);
    }
    setStatus({ ...status, review: undefined, intro: undefined });
  });
  loadApp(createWindow());

  const installLog: string[] = [];
  try {
    const root = serverRoot(app);
    await ensureInstalled(installUi(installLog), root, app.getVersion());
    if (process.env.MILES_INSTALL_DRY_RUN && !installed(root)) throw new Error("Dry run finished, nothing was installed.");
    await startServer(
      root,
      join(app.getPath("userData"), "server.log"),
      (update) => setStatus({ state: "starting", ...update }),
    );
    setStatus({ state: "ready", text: "" });
  } catch (error) {
    const log = lastLogLines() || installLog.slice(-15).join("\n");
    setStatus({ state: "error", text: `${(error as Error).message}\n\n${log}` });
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
