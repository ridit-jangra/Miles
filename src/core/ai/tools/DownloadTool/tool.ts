import { tool } from "ai";
import { z } from "zod";
import { writeFile, mkdir } from "fs/promises";
import { dirname, basename, extname, resolve, sep } from "path";
import { DESCRIPTION, PROMPT } from "./prompt";
import { requestPermission } from "../../permissions";

const TRUSTED_DOMAINS = [
  "github.com",
  "raw.githubusercontent.com",
  "gitlab.com",
  "raw.gitlab.com",
  "cdn.undraw.co",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.jsdelivr.net",
  "unpkg.com",
  "codeberg.org",
  "raw.codeberg.org",
];

const BLOCKED_EXTENSIONS = [
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bat",
  ".cmd",
  ".sh",
  ".bash",
  ".bin",
  ".msi",
  ".pkg",
  ".dmg",
  ".app",
  ".jar",
  ".war",
  ".ear",
  ".py",
  ".php",
  ".rb",
  ".pl",
  ".cgi",
  ".vbs",
  ".ps1",
  ".psm1",
  ".sql",
  ".db",
  ".sqlite",
  ".reg",
  ".inf",
  ".sys",
];

const SAFE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
  ".ico",
  ".tiff",

  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".eot",

  ".pdf",
  ".txt",
  ".md",
  ".json",
  ".xml",
  ".csv",
  ".yaml",
  ".yml",

  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".mjs",
  ".cjs",

  ".zip",
  ".tar",
  ".gz",
  ".7z",
];

const BLOCKED_MIME = [
  "application/x-msdownload",
  "application/x-sh",
  "text/x-shellscript",
  "application/x-executable",
  "application/x-msdos-program",
];

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

function validateUrl(
  url: string,
  force: boolean,
): { ok: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    if (!parsed.protocol.match(/^https?:$/)) {
      return { ok: false, reason: "Only http/https protocols are allowed" };
    }

    const hostname = parsed.hostname.toLowerCase();
    const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "169.254."];
    if (BLOCKED_HOSTS.some((b) => hostname.includes(b))) {
      return { ok: false, reason: `Blocked host: ${hostname}` };
    }

    if (!force) {
      const isTrusted = TRUSTED_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
      if (!isTrusted) {
        return {
          ok: false,
          reason: `Domain "${hostname}" is not trusted. Pass force=true to override (requires user approval).`,
        };
      }
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
}

function validateExtension(filename: string): { ok: boolean; reason?: string } {
  const ext = extname(filename).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return { ok: false, reason: `Blocked file extension: ${ext}` };
  }
  if (!SAFE_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      reason: `Unknown/unsafe extension: ${ext}. Not in safe list.`,
    };
  }
  return { ok: true };
}

function validateMime(contentType: string): { ok: boolean; reason?: string } {
  const mime = contentType.split(";")[0]?.trim() ?? "";
  if (BLOCKED_MIME.some((m) => mime.startsWith(m))) {
    return { ok: false, reason: `Blocked content-type: ${mime}` };
  }
  return { ok: true };
}

function sanitizePath(basePath: string, userPath: string): string {
  const resolvedBase = resolve(basePath);
  const resolvedFull = resolve(basePath, userPath);

  if (
    resolvedFull !== resolvedBase &&
    !resolvedFull.startsWith(resolvedBase + sep)
  ) {
    throw new Error("Path traversal attempt detected");
  }

  return resolvedFull;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const DownloadTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    url: z.string().describe("The URL to download from"),
    destination: z
      .string()
      .optional()
      .describe("Directory to save the file in (defaults to cwd)"),
    filename: z
      .string()
      .optional()
      .describe(
        "Override the downloaded filename (defaults to filename from URL)",
      ),
    force: z
      .boolean()
      .optional()
      .default(false)
      .describe("Bypass trusted domain check — still requires user approval"),
  }),
  title: "DownloadFile",
  execute: async ({ url, destination, filename, force }) => {
    try {
      const urlCheck = validateUrl(url, force ?? false);
      if (!urlCheck.ok) {
        return { success: false, error: urlCheck.reason };
      }

      const urlFilename = basename(new URL(url).pathname) || "downloaded_file";
      const finalFilename = filename || urlFilename;

      const extCheck = validateExtension(finalFilename);
      if (!extCheck.ok) {
        return { success: false, error: extCheck.reason };
      }

      const baseDir = destination || process.cwd();
      let safePath: string;
      try {
        safePath = sanitizePath(baseDir, finalFilename);
      } catch (e) {
        return { success: false, error: String(e) };
      }

      const decision = await requestPermission("DownloadTool", {
        url,
        destination: safePath,
        force: force ?? false,
      });
      if (decision === "deny") {
        return { success: false, error: "User denied permission" };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Milo/1.0)" },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const mimeCheck = validateMime(contentType);
      if (!mimeCheck.ok) {
        return { success: false, error: mimeCheck.reason };
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const declared = parseInt(contentLength, 10);
        if (declared > MAX_SIZE_BYTES) {
          return {
            success: false,
            error: `File too large: ${formatSize(declared)} exceeds 50 MB limit`,
          };
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
        return {
          success: false,
          error: `File too large: ${formatSize(arrayBuffer.byteLength)} exceeds 50 MB limit`,
        };
      }

      await mkdir(dirname(safePath), { recursive: true });
      await writeFile(safePath, Buffer.from(arrayBuffer));

      return {
        success: true,
        path: safePath,
        filename: finalFilename,
        size: formatSize(arrayBuffer.byteLength),
        contentType: contentType || "unknown",
        url,
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, error: "Download timed out after 30 seconds" };
      }
      return { success: false, error: String(err) };
    }
  },
});
