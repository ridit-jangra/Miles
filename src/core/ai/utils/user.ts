import type { User } from '../types'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { readFileSync } from 'fs'
import { HUMAN_FILE } from './env'
import { dirname } from 'path'

const DEFAULT_HUMAN: User = {
  name: 'default-human',
  gender: 'other'
}

export function readHumanSync(): User {
  try {
    const raw = readFileSync(HUMAN_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as User
    return parsed
  } catch {
    return { ...DEFAULT_HUMAN }
  }
}

export async function readHuman(): Promise<User> {
  try {
    const raw = await readFile(HUMAN_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as User
    return parsed
  } catch {
    return { ...DEFAULT_HUMAN }
  }
}

export async function writeHuman(human: User): Promise<void> {
  await mkdir(dirname(HUMAN_FILE), { recursive: true })
  await writeFile(HUMAN_FILE, JSON.stringify(human, null, 2), 'utf-8')
}
