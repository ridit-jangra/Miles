const MAX_LINES_TO_READ = 2000;
const MAX_LINE_LENGTH = 2000;

export const DESCRIPTION = "Read a file from the local filesystem.";
export const PROMPT = `Reads a file from the local filesystem. The file_path parameter must be an absolute path, not a relative path. By default, it reads up to ${MAX_LINES_TO_READ} lines starting from the beginning of the file. You can optionally specify line_start and line_end (1-indexed, inclusive) to read a specific range — e.g. line_start=10, line_end=50 reads lines 10 to 50. Any lines longer than ${MAX_LINE_LENGTH} characters will be truncated. For image files, the tool will display the image for you.`;
