// Startet API-Server (Port 8787, mit Auto-Neustart) und Vite gemeinsam: npm run dev
import { spawn } from 'node:child_process'

const node = process.execPath
const procs = [
  spawn(node, ['--watch-path=server', '--watch-path=src/lib', 'server/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '8787' }, // fix, Vite leitet /api hierhin weiter
  }),
  spawn(node, ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)], { stdio: 'inherit' }),
]
const stop = () => {
  procs.forEach((p) => p.kill())
  process.exit()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
procs.forEach((p) => p.on('exit', stop))
