import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'
import { SERVER_PORT } from '../../shared/constants'
import { ensureAssets } from './assets'

let serverProcess: ChildProcess | null = null

function binaryPath(): string {
  const exe = process.platform === 'win32' ? 'server.exe' : 'server'
  return join(process.resourcesPath, 'server', exe)
}

async function waitForHealth(timeoutMs = 90000): Promise<boolean> {
  const url = `http://127.0.0.1:${SERVER_PORT}/health`
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

export async function startServer(): Promise<void> {
  if (!app.isPackaged) {
    console.log('[server] dev mode — expecting `npm run start:server`')
    return
  }

  const bin = binaryPath()
  if (!existsSync(bin)) {
    console.error(`[server] frozen binary not found at ${bin}`)
    return
  }

  let assets: Awaited<ReturnType<typeof ensureAssets>>
  try {
    assets = await ensureAssets()
  } catch (err) {
    console.error('[server] asset download failed, cannot start:', err)
    return
  }

  // Models live in userData, fetched on first run to keep the app download
  // under GitHub's 2GB asset cap. CUDA libs are bundled in the frozen server.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ECHO_MODELS_DIR: assets.modelsDir,
    ECHO_SERVER_HOST: '127.0.0.1',
    ECHO_SERVER_PORT: SERVER_PORT
  }

  serverProcess = spawn(bin, [], { env, stdio: 'inherit' })

  serverProcess.on('exit', (code) => {
    console.log(`[server] exited (code ${code})`)
    serverProcess = null
  })

  serverProcess.on('error', (err) => {
    console.error('[server] failed to start:', err)
    serverProcess = null
  })

  waitForHealth().then((ok) =>
    console.log(ok ? '[server] ready' : '[server] health check timed out')
  )
}

export function stopServer(): void {
  if (!serverProcess) return
  serverProcess.kill()
  serverProcess = null
}
