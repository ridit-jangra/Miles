import { app, BrowserWindow, dialog, ipcMain, Menu, session, type MenuItemConstructorOptions } from "electron";
import { join } from "node:path";

import { installLauncher } from "./desktop";
import { ensureCurrent, ensureInstalled, installed, type InstallUI } from "./install";
import { isManaged, serverRoot } from "./paths";
import { type BootStep, lastLogLines, sendToServer, startServer, stopServer } from "./server";
import { planUninstall, runUninstall } from "./uninstall";
import { downloadAppUpdate, findAppUpdate, installAppUpdate, updatesEnabled } from "./update";

type ServerStatus = {
  state: "starting" | "ready" | "error";
  text: string;
  steps?: { id: string; label: string; state: "pending" | "active" | "done"; fraction: number }[];
  log?: string;
  title?: string;
  intro?: string;
  notice?: string;
  form?: { fields: { name: string; label: string; provider: string; secret: boolean }[]; error: string | null };
  review?: { name: string; state: "new" | "changed"; description: string; permissions: string[]; dependencies: string[]; servers: { name: string; run: string }[]; selected?: boolean }[];
};

let status: ServerStatus = { state: "starting", text: "Starting Miles…" };

function setStatus(next: ServerStatus): void {
  status = next;
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send("server:status", next);
}

const installSteps = new Map<string, BootStep>();
let waiting: ((names: string[]) => void) | null = null;
let acknowledging: (() => void) | null = null;

function installUi(installLog: string[]): InstallUI & { setTitle(title: string): void } {
  let title = "Installing Miles";
  return {
    setTitle(next) {
      title = next;
    },
    step(id, label, state, fraction = 0) {
      installSteps.set(id, { id, label, state, fraction });
      setStatus({ ...status, state: "starting", text: "", title, steps: [...installSteps.values()] });
    },
    log(line) {
      installLog.push(line);
      setStatus({ ...status, log: line });
    },
    ask(items, intro = "Miles needs a few tools to set itself up. Pick what it may install.") {
      return new Promise((resolve) => {
        waiting = resolve;
        setStatus({ ...status, state: "starting", text: "", title, intro, review: items });
      });
    },
    notice(text) {
      return new Promise((resolve) => {
        acknowledging = resolve;
        setStatus({ ...status, state: "starting", text: "", title, notice: text, review: undefined });
      });
    },
  };
}

type UpdateResult = "none" | "declined" | "failed" | "restarting";

async function offerAppUpdate(ui: ReturnType<typeof installUi>, serverRunning: boolean, known?: string): Promise<UpdateResult> {
  const version = known ?? (await findAppUpdate());
  if (!version) return "none";
  ui.setTitle("Update available");
  const approved = await ui.ask(
    [
      {
        name: `Miles ${version}`,
        state: "new",
        selected: true,
        description: `You have ${app.getVersion()}. Miles downloads the new version, restarts, and then updates its server to match.`,
        permissions: [],
        dependencies: [],
        servers: [{ name: "update", run: `download Miles ${version} from GitHub and replace this app` }],
      },
    ],
    "A new version of Miles is available. Update now?",
  );
  if (!approved.length) return "declined";
  const label = `Downloading Miles ${version}`;
  try {
    if (serverRunning) await stopServer();
    ui.step("update", label, "active", 0);
    await downloadAppUpdate((fraction) => ui.step("update", label, "active", fraction));
    ui.step("update", label, "done", 1);
    ui.step("restart", "Restarting Miles", "active", -1);
    installAppUpdate();
    return "restarting";
  } catch (error) {
    await ui.notice(`The update failed: ${(error as Error).message}\n\nMiles will keep running version ${app.getVersion()}.`);
    return "failed";
  }
}

let checking = false;
async function checkForUpdatesNow(): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    if (!updatesEnabled()) {
      await dialog.showMessageBox({ message: "Updates only work in the installed app." });
      return;
    }
    const version = await findAppUpdate();
    if (!version) {
      await dialog.showMessageBox({ message: "Miles is up to date.", detail: `You have version ${app.getVersion()}.` });
      return;
    }
    installSteps.clear();
    const result = await offerAppUpdate(installUi([]), true, version);
    if (result === "declined") setStatus({ state: "ready", text: "" });
    else if (result === "failed") void boot();
  } finally {
    checking = false;
  }
}

async function uninstallNow(): Promise<void> {
  if (!isManaged(app)) {
    await dialog.showMessageBox({ message: "This copy of Miles isn't managed by the app, so there is nothing for it to uninstall." });
    return;
  }
  const first = await dialog.showMessageBox({
    type: "warning",
    title: "Uninstall Miles",
    message: "Uninstall Miles?",
    detail: "You can remove just the program and keep your memories, settings, keys and plugins, or remove everything.",
    buttons: ["Cancel", "Remove the program, keep my data", "Remove everything"],
    defaultId: 0,
    cancelId: 0,
    checkboxLabel: "Also delete the downloaded speech models",
  });
  if (first.response === 0) return;
  const mode = first.response === 2 ? "everything" : "program";
  const plan = planUninstall(mode, first.checkboxChecked, app.getPath("userData"));
  if (plan.problem) {
    await dialog.showMessageBox({ type: "error", message: plan.problem });
    return;
  }
  if (mode === "everything") {
    const sure = await dialog.showMessageBox({
      type: "warning",
      message: "Delete everything?",
      detail: `This permanently deletes your memories, settings, API keys and plugins:\n\n${plan.remove.join("\n")}`,
      buttons: ["Cancel", "Delete everything"],
      defaultId: 0,
      cancelId: 0,
    });
    if (sure.response === 0) return;
  }
  installSteps.clear();
  setStatus({ state: "starting", text: "", title: "Uninstalling Miles" });
  await stopServer();
  const failed = runUninstall(plan);
  const file = process.env.APPIMAGE ? `\n\nYou can now delete the app file itself:\n${process.env.APPIMAGE}` : "";
  await dialog.showMessageBox({
    message: failed.length ? "Miles was mostly removed" : "Miles was removed",
    detail: (failed.length ? `Couldn't remove: ${failed.join(", ")}.` : "") + file,
  });
  app.quit();
}

function setupMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    { label: "Miles", submenu: [{ label: "Check for updates…", click: () => void checkForUpdatesNow() }, { label: "Uninstall Miles…", click: () => void uninstallNow() }, { type: "separator" }, { role: "quit" }] },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function boot(): Promise<void> {
  const installLog: string[] = [];
  try {
    const root = serverRoot(app);
    const ui = installUi(installLog);
    await ensureInstalled(ui, root, app.getVersion());
    if (isManaged(app)) {
      if ((await offerAppUpdate(ui, false)) === "restarting") return;
      ui.setTitle("Updating Miles");
      await ensureCurrent(ui, root, app.getVersion());
      installSteps.clear();
    }
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
  ipcMain.handle("server:answer", (_event, values: Record<string, string> | null) => {
    sendToServer({ answer: values });
    setStatus({ ...status, form: undefined });
  });
  ipcMain.handle("server:ack", () => {
    if (acknowledging) {
      acknowledging();
      acknowledging = null;
    }
    setStatus({ ...status, notice: undefined });
  });
  loadApp(createWindow());
  setupMenu();
  await boot();

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
