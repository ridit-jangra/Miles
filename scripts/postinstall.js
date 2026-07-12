const { execSync } = require('child_process')
const { rmSync } = require('fs')
const { join, delimiter } = require('path')

if (process.platform === 'win32') {
  rmSync(join(__dirname, '..', 'node_modules', 'usocket'), { recursive: true, force: true })
}

execSync('electron-builder install-app-deps', {
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: join(__dirname, '..', 'node_modules', '.bin') + delimiter + process.env.PATH
  }
})
