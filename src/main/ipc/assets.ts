import { app } from 'electron'
import { spawn } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs'
import { rm, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import { join } from 'path'
import { Readable } from 'stream'

const REPO = 'ridit-jangra/Echo'

export type AssetPaths = { modelsDir: string }

type Pack = {
  name: string
  file: string
  dir: string
  marker: string
}

function baseDir(): string {
  const dir = join(app.getPath('userData'), 'assets')
  mkdirSync(dir, { recursive: true })
  return dir
}

function releaseUrl(file: string): string {
  return `https://github.com/${REPO}/releases/download/v${app.getVersion()}/${file}`
}

async function download(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`GET ${url} -> ${res.status}`)
  const total = Number(res.headers.get('content-length') || 0)
  let seen = 0
  let lastPct = -1
  const out = createWriteStream(dest)
  const reader = Readable.fromWeb(res.body as never)
  reader.on('data', (chunk: Buffer) => {
    seen += chunk.length
    if (total) {
      const pct = Math.floor((seen / total) * 100)
      if (pct >= lastPct + 5) {
        lastPct = pct
        console.log(`[assets] downloading ${dest.split('/').pop()}: ${pct}%`)
      }
    }
  })
  await new Promise<void>((resolve, reject) => {
    reader.pipe(out)
    out.on('finish', resolve)
    out.on('error', reject)
    reader.on('error', reject)
  })
}

async function sha256(file: string): Promise<string> {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

async function extract(tarball: string, dir: string): Promise<void> {
  mkdirSync(dir, { recursive: true })
  await new Promise<void>((resolve, reject) => {
    const p = spawn('tar', ['-xzf', tarball, '-C', dir], { stdio: 'inherit' })
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tar exit ${code}`))))
    p.on('error', reject)
  })
}

async function ensurePack(pack: Pack): Promise<void> {
  if (existsSync(pack.marker)) return
  console.log(`[assets] fetching ${pack.name} pack...`)

  const tmp = join(baseDir(), pack.file)
  await download(releaseUrl(pack.file), tmp)

  const sumRes = await fetch(releaseUrl(`${pack.file}.sha256`))
  if (sumRes.ok) {
    const expected = (await sumRes.text()).trim().split(/\s+/)[0]
    const actual = await sha256(tmp)
    if (expected && expected !== actual) {
      await rm(tmp, { force: true })
      throw new Error(`${pack.name} checksum mismatch (expected ${expected}, got ${actual})`)
    }
  }

  await rm(pack.dir, { recursive: true, force: true })
  await extract(tmp, pack.dir)
  await rm(tmp, { force: true })
  await writeFile(pack.marker, new Date().toISOString())
  console.log(`[assets] ${pack.name} ready at ${pack.dir}`)
}

export async function ensureAssets(): Promise<AssetPaths> {
  const base = baseDir()
  const modelsDir = join(base, 'models')

  await ensurePack({
    name: 'models',
    file: 'models.tar.gz',
    dir: modelsDir,
    marker: join(base, 'models.ready')
  })

  return { modelsDir }
}
