import { cwd } from "process";

export const DESCRIPTION = "Write a file to the local filesystem.";

export const PROMPT = `Write a file to the local filesystem. Overwrites the existing file if there is one.

The current working directory is: ${cwd()}

Path resolution rules:
- If an absolute path is provided, use it as-is
- If a relative path is provided, resolve it against the current working directory above

Before using this tool:

1. If overwriting an existing file, use ReadFile first to understand its contents.
   If creating a new file, skip this step.

2. Directory Verification (only applicable when creating new files):
   - Use the LS tool to verify the parent directory exists and is the correct location`;
