import { existsSync, readdirSync, opendirSync } from 'fs'
import { basename, dirname, extname, join } from 'path'

export function addLineNumbers(content: string, startLine = 1): string {
  if (!content) return ''
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const lineNum = index + startLine
      const numStr = String(lineNum)
      if (numStr.length >= 6) return `${numStr}\t${line}`
      return `${numStr.padStart(6, ' ')}\t${line}`
    })
    .join('\n')
}

export function findSimilarFile(filePath: string): string | undefined {
  try {
    const dir = dirname(filePath)
    const fileBaseName = basename(filePath, extname(filePath))
    if (!existsSync(dir)) return undefined
    const files = readdirSync(dir)
    const similar = files.filter(
      (f) => basename(f, extname(f)) === fileBaseName && join(dir, f) !== filePath
    )
    return similar[0]
  } catch {
    return undefined
  }
}

export function isDirEmpty(dirPath: string): boolean {
  try {
    const dir = opendirSync(dirPath)
    const firstEntry = dir.readSync()
    dir.closeSync()
    return firstEntry === null
  } catch {
    return false
  }
}
