import { tool } from "ai";
import { z } from "zod";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { platform } from "os";
import { shell } from "electron";
import { DESCRIPTION, PROMPT } from "./prompt";
import { requestPermission } from "../../permissions";

type Kind = "app" | "file" | "url";

function detectKind(target: string): Kind {
  if (/^https?:\/\//i.test(target)) return "url";
  if (existsSync(target)) return "file";
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(target)) return "url";
  return "app";
}

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.hostname !== "localhost" && !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function spawnDetached(cmd: string, args: string[], onError?: () => void): void {
  const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
  if (onError) child.on("error", onError);
  child.unref();
}

function launchApp(
  name: string,
  args: string[],
): { success: boolean; error?: string } {
  const os = platform();
  try {
    if (os === "darwin") {
      spawnDetached("open", ["-a", name, ...args]);
    } else if (os === "win32") {
      spawnDetached("cmd", ["/c", "start", "", name, ...args]);
    } else {
      spawnDetached("gtk-launch", [name, ...args], () =>
        spawnDetached(name, args, () => spawnDetached("xdg-open", [name])),
      );
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export const OpenAppTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    target: z
      .string()
      .describe("The app name, absolute file path, or URL to open"),
    kind: z
      .enum(["app", "file", "url"])
      .optional()
      .describe("Force how target is interpreted (otherwise auto-detected)"),
    args: z
      .array(z.string())
      .optional()
      .describe("Extra arguments passed when launching an app"),
  }),
  title: "OpenApp",
  execute: async ({ target, kind, args }) => {
    const resolved: Kind = kind ?? detectKind(target);

    const decision = await requestPermission("OpenAppTool", {
      target,
      kind: resolved,
    });
    if (decision === "deny") {
      return { success: false, error: "User denied permission" };
    }

    try {
      if (resolved === "url") {
        const url = normalizeUrl(target);
        if (!url) {
          return {
            success: false,
            target,
            kind: resolved,
            error: `"${target}" is not a valid URL. Pass a full address with a real domain, e.g. https://www.youtube.com`,
          };
        }
        await shell.openExternal(url);
        return { success: true, target: url, kind: resolved };
      }

      if (resolved === "file") {
        if (!existsSync(target)) {
          return {
            success: false,
            error: `File not found: ${target}`,
          };
        }
        const err = await shell.openPath(target);
        if (err) return { success: false, target, kind: resolved, error: err };
        return { success: true, target, kind: resolved };
      }

      const result = launchApp(target, args ?? []);
      return result.success
        ? { success: true, target, kind: resolved }
        : { success: false, target, kind: resolved, error: result.error };
    } catch (err) {
      return { success: false, target, kind: resolved, error: String(err) };
    }
  },
});
