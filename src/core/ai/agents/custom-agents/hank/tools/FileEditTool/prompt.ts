export const DESCRIPTION = 'Replace an exact string in a file.'

export const PROMPT = `Does an exact-match replacement of old_string with new_string in a file. old_string must be unique in the file (include surrounding context to make it unique), or pass replace_all to replace every occurrence. Prefer this over rewriting a whole file with FileWrite.`
