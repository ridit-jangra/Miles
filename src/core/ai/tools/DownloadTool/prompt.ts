export const DESCRIPTION = `Download a file from a trusted source.

Downloads files from trusted URLs for assets like images, fonts, code snippets, and other project resources.

Security restrictions:
- Only allowed from trusted domains: github.com, raw.githubusercontent.com, undraw.co, fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net, unpkg.com, gitlab.com, raw.gitlab.com
- Blocked file types: executable files (.exe, .dll, .bat, .cmd, .sh, .bin, .msi, .pkg, .dmg, .app, .jar), scripts (.py, .php, .rb, .pl, .cgi, .vbs, .ps1), and other potentially dangerous types
- Maximum size: 50 MB
- Path validation prevents directory traversal attacks

Use this for:
- Downloading images from undraw.co for UI mockups
- Getting fonts from Google Fonts
- Downloading code snippets from GitHub Gists
- Fetching project assets from trusted CDNs`;

export const PROMPT = `Before downloading, check:
1. URL domain is in the trusted whitelist
2. File extension is safe (images, fonts, JSON, text, etc.)
3. You have a valid reason to download this specific file for the current task

The tool will:
1. Validate the URL against trusted domains
2. Check file type against blocked extensions
3. Stream the download with a 30-second timeout
4. Save to the specified destination (or current directory)
5. Return the file path and size on success`;
