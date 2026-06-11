import { EventEmitter } from 'events'

const KEY = '__echo_shell_stream__'

type ProcessWithStream = NodeJS.Process & Record<string, unknown>

const proc = process as ProcessWithStream

if (!proc[KEY]) {
  proc[KEY] = new EventEmitter()
}

export const shellStream: EventEmitter = proc[KEY] as EventEmitter
