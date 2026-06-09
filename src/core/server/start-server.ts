import { ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const isWindows = process.platform === 'win32'

export function startServer(echoDir: string): ChildProcessWithoutNullStreams {
  const venvDir = join(echoDir, '.venv')
  const coreDir = join(echoDir, 'src', 'core')
  const serverDir = join(coreDir, 'server')
  const modelsDir = join(echoDir, 'models')

  const uvicorn = isWindows
    ? join(venvDir, 'Scripts', 'uvicorn.exe')
    : join(venvDir, 'bin', 'uvicorn')

  const echoModel = join(modelsDir, 'echo.onnx')
  const wakeWordModel = existsSync(echoModel) ? echoModel : 'hey_jarvis'

  console.log(`[Echo] Starting server...`)
  console.log(`[Echo] Wake word: ${wakeWordModel}`)

  const server = spawn(
    uvicorn,
    ['server:app', '--host', '127.0.0.1', '--port', '8000', '--log-level', 'info'],
    {
      cwd: serverDir,
      env: {
        ...process.env,
        TRANSFORMERS_OFFLINE: '1',
        HF_DATASETS_OFFLINE: '1',
        WAKE_WORD_MODEL: wakeWordModel
      },
      stdio: 'pipe'
    }
  )

  server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`))
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`))
  server.on('exit', (code) => console.log(`[Echo] Server exited: ${code}`))

  return server
}
