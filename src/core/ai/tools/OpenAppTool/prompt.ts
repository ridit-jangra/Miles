export const DESCRIPTION =
  "Open an application, a file, or a URL on the user's computer.";

export const PROMPT = `Launches things on the user's machine: desktop apps, files (in their default app), or URLs (in the default browser).

Use this — not BashTool — whenever the user asks to "open" something.

The "kind" is auto-detected from the target, but you can force it:
- url  → anything starting with http:// or https:// opens in the default browser
- file → an existing absolute path opens in its default app (e.g. a folder, a PDF, an image)
- app  → a desktop application launched by name (e.g. "code", "spotify", "google-chrome")

Guidelines:
- For a URL, always pass a COMPLETE address with a real domain. Never pass a bare word. "open youtube" means target "https://www.youtube.com", not "youtube". "search youtube for lofi" means "https://www.youtube.com/results?search_query=lofi".
- Always pass absolute paths for files.
- For apps, use the executable / launcher name, lowercase (e.g. "google-chrome", not "Google Chrome") on Linux.
- App-by-name on Linux is best-effort (it tries the .desktop launcher, then the raw binary). If it fails, fall back to opening a URL or file instead.
- The app is launched detached, so it keeps running after this returns. A success result means the launch was issued, not that the app finished loading.
- This tool opens things in the user's DEFAULT browser/app and does not control them. If you need to click, type, scroll, or read what's on a page, use the chrome-devtools tools (navigate_page, click, fill, take_snapshot) instead — those drive a browser you can see and control.`;
