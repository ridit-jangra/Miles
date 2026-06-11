import { join } from 'path'
import { homedir } from 'os'
import { cwd } from 'process'
import { mkdirSync } from 'fs'

export const ECHO_BASE_DIR = join(homedir(), '.echo')
export const MEMORY_DIR = join(ECHO_BASE_DIR, 'memory')

mkdirSync(ECHO_BASE_DIR, { recursive: true })
mkdirSync(MEMORY_DIR, { recursive: true })

export const PROJECT_MEMORY_FILE = join(cwd(), 'MILO.md')
export const SESSIONS_DIR = join(ECHO_BASE_DIR, 'sessions')
export const HUMAN_FILE = join(ECHO_BASE_DIR, 'user.json')
export const EXECUTION_STATE_FILE = join(ECHO_BASE_DIR, 'execution-state.json')
export const PORT_FILE = join(ECHO_BASE_DIR, 'milo.port')
export const CONFIG_FILE = join(ECHO_BASE_DIR, 'config.json')
export const BOOTSTRAP_FILE = join(ECHO_BASE_DIR, 'bootstrap.txt')
export const HUMAN_MEMORY_FILE = join(MEMORY_DIR, 'human-memory.md')
