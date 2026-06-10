import { FileReadTool } from "../FileReadTool/tool.js";
import { platform } from "os";

export const MAX_OUTPUT_LENGTH = 3000;
export const MAX_RENDERED_LINES = 50;

export const BANNED_COMMANDS = [
  "alias",
  "curl",
  "curlie",
  "wget",
  "axel",
  "aria2c",
  "nc",
  "telnet",
  "lynx",
  "w3m",
  "links",
  "httpie",
  "xh",
  "http-prompt",
  "chrome",
  "firefox",
  "safari",
];

const isWindows = platform() === "win32";
const CHAIN = isWindows ? ";" : "&&";

const PLATFORM_NOTES = isWindows
  ? `- This is Windows running PowerShell — use PowerShell cmdlets and syntax
- ALWAYS wrap paths containing spaces in double quotes: "C:\\Users\\Time Machine\\file.txt"
- Use Get-ChildItem (or ls/dir as aliases) instead of ls — but prefer GlobTool for listing
- Use Select-String instead of grep: Select-String -Pattern "foo" -Path "file.txt"
- Use Test-Path to check if a file exists: if (Test-Path "C:\\path\\to\\file") { "yes" }
- Use New-Item -ItemType Directory -Force instead of mkdir -p
- For background processes use: Start-Process <command>
- NEVER use && on Windows PowerShell — it is not supported reliably
- ALWAYS use ; to chain commands
- Use $env:TEMP for temp directory, not %TEMP%
- Paths with spaces MUST always be quoted — this is the most common source of errors
- NEVER use cmd.exe syntax (if exist, start /b, findstr) — use PowerShell equivalents
- Use Remove-Item -Recurse -Force instead of rd /s /q
- Use Copy-Item instead of copy/xcopy
- Use Move-Item instead of move`
  : `- This is ${platform()} — use standard unix commands (ls, grep, find, cat etc.)
- For background processes use: <command> &`;

export const DESCRIPTION =
  "Execute a bash command in a persistent shell session.";

export const PROMPT = `Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.

Before executing the command, please follow these steps:

1. Directory Verification:
   - If the command will create new directories or files, first verify the parent directory exists

2. Security Check:
   - Some commands are banned. If you use one, you will receive an error. Explain it to the user.
   - Banned commands: ${BANNED_COMMANDS.join(", ")}

3. Command Execution:
   - After ensuring proper quoting, execute the command.

4. Output Processing:
   - Output exceeding ${MAX_OUTPUT_LENGTH} characters will be truncated.

5. Return Result:
   - Provide the processed output.
   - Include any errors that occurred.

Platform: ${platform()}

Usage notes:
${PLATFORM_NOTES}
- Use ; on windows and && on linux or mac to chain multiple commands, never newlines
- Always use ; on windows to chain multiple commands. ALWAYS.
- Avoid cat, head, tail — use ${FileReadTool.title} to read files instead
- To list files in a directory, use GlobTool with pattern "dirname/**/*" — never use dir or ls for this
- Timeout defaults to 30 minutes, max 10 minutes per command
- All commands share the same shell session — env vars and cwd persist between commands
- Prefer absolute paths, avoid cd
- When listing directory contents recursively, NEVER recurse into node_modules, .git, dist, or build folders

# Directory listing
- Always use GlobTool to list files — never use dir or ls recursively
- Before listing files recursively, exclude: node_modules, .git, dist, build, .next, out, coverage

# Git
THERE IS NO GitTool. NEVER call GitTool. Use BashTool for ALL git operations, no exceptions.
- On Windows PowerShell, ALWAYS use double quotes for commit messages: git commit -m "feat: message here"
- NEVER use single quotes for commit messages on Windows PowerShell — they are treated as literals
- If you see a git commit error on Windows, immediately retry with double quotes

When asked to commit, push, or do anything git-related:
1. ALWAYS use BashTool — there is NO GitTool
2. Run git status; git diff HEAD in one BashTool call first
3. Stage files with git add -A (or specific files if asked)
4. Commit with git commit -m "type: message" (double quotes on Windows)
5. Push with git push origin <branch>

Examples — memorize these patterns:
- "commit this" → git add -A ${CHAIN} git commit -m "feat: ..."
- "push" → git push origin main
- "commit and push" → git add -A ${CHAIN} git commit -m "..." ${CHAIN} git push origin main
- "commit with message X" → git add -A ${CHAIN} git commit -m "X"
- "what branch am I on?" → git branch --show-current
- "show last commit" → git log -1 --oneline
- "show changes" → git status; git diff HEAD
- "undo last commit" → git reset --soft HEAD~1
- "create branch" → git checkout -b <name>
- "stash changes" → git stash

Rules:
- Never use -i flag on any git command
- Never invent git subcommands that don't exist
- Never call GitTool — it does not exist, it has never existed
- Always run git status && git diff HEAD before generating a commit message
- Use conventional commits: feat, fix, chore, refactor, docs, test, style
- Prefer git add -A over git add . for staging all changes`;
