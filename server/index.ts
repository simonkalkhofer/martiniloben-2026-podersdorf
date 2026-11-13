/**
 * Martiniloben-Server: JSON-API unter /api, Live-Updates per Server-Sent Events
 * (/api/events) und Auslieferung der gebauten App aus dist/.
 *
 * Start:  node server/index.ts          (PORT=8787, DATA_DIR=./data)
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { openDb } from './db.ts'
import { createGame, GameError } from './game.ts'

const PORT = Number(process.env.PORT ?? 8787)
const ROOT = resolve(import.meta.dirname, '..')
// Railway setzt RAILWAY_VOLUME_MOUNT_PATH automatisch, sobald ein Volume angehängt ist
const DATA_DIR = resolve(process.env.DATA_DIR ?? process.env.RAILWAY_VOLUME_MOUNT_PATH ?? join(ROOT, 'data'))
const DIST = join(ROOT, 'dist')

if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) {
  console.warn('ACHTUNG: Kein Railway-Volume angehängt – der Spielstand geht beim nächsten Deploy verloren!')
}

// ------------------------------------------------------------ Live-Updates
const clients = new Set<ServerResponse>()
let version = 0
function broadcast() {
  version++
  for (const res of clients) res.write(`data: ${version}\n\n`)
}
setInterval(() => { for (const res of clients) res.write(': ping\n\n') }, 25_000).unref()

const db = openDb(DATA_DIR)
const game = createGame(db, broadcast)

// ---------------------------------------------------------------- Helfer
function send(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body ?? null)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(json)
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > 10_000) throw new GameError('Anfrage zu groß', 413)
    chunks.push(chunk as Buffer)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new GameError('Ungültiges JSON')
  }
}

const tokenOf = (req: IncomingMessage) => req.headers.authorization?.replace(/^Bearer\s+/i, '') || undefined
const num = (v: unknown) => Number(v)

// ------------------------------------------------------------------- API
type Handler = (token: string | undefined, body: Record<string, unknown>) => unknown
const routes: Record<string, Handler> = {
  'GET /api/health': () => ({ ok: true }),
  'GET /api/players': () => game.listPlayers(),
  'POST /api/login': (_, b) => game.login(num(b.playerId), String(b.pin ?? '')),
  'POST /api/logout': (t) => game.logout(t),
  'GET /api/state': (t) => game.getState(t),
  'POST /api/draw': (t, b) => game.drawCard(t, num(b.level)),
  'POST /api/report': (t, b) => game.reportDone(t, num(b.cardId), num(b.witnessId)),
  'POST /api/give-up': (t, b) => game.giveUp(t, num(b.cardId)),
  'POST /api/resolve': (t, b) => game.resolve(t, num(b.cardId), b.approve === true),
  'GET /api/admin/overview': (t) => game.adminOverview(t),
  'POST /api/admin/players': (t, b) => game.adminAddPlayer(t, String(b.name ?? '')),
  'POST /api/admin/reset-pin': (t, b) => game.adminResetPin(t, num(b.playerId)),
  'POST /api/admin/reset-draws': (t, b) => game.adminResetDraws(t, b.playerId == null ? null : num(b.playerId)),
  'POST /api/admin/settings': (t, b) => game.adminUpdateSettings(t, {
    drawsPerDay: b.drawsPerDay === undefined ? undefined : num(b.drawsPerDay),
    paused: b.paused === undefined ? undefined : b.paused === true,
    announcement: b.announcement === undefined ? undefined : String(b.announcement),
  }),
  'POST /api/admin/give-extra': (t, b) => game.adminGiveExtra(t, num(b.playerId), num(b.count)),
  'POST /api/admin/resolve': (t, b) => game.adminResolve(t, num(b.cardId), b.approve === true),
  'POST /api/admin/return-card': (t, b) => game.adminReturnCard(t, num(b.cardId)),
  'POST /api/admin/delete-player': (t, b) => game.adminDeletePlayer(t, num(b.playerId)),
  'POST /api/admin/reset-game': (t) => game.adminResetGame(t),
  'POST /api/admin/announcer': (t, b) => game.adminSetAnnouncer(t, num(b.playerId), b.allowed === true),
  'POST /api/announce': (t, b) => game.announce(t, String(b.text ?? '')),
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string) {
  if (path === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(`retry: 3000\ndata: ${version}\n\n`)
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }
  const handler = routes[`${req.method} ${path}`]
  if (!handler) return send(res, 404, { error: 'Nicht gefunden' })
  try {
    const body = req.method === 'POST' ? await readBody(req) : {}
    send(res, 200, (await handler(tokenOf(req), body)) ?? { ok: true })
  } catch (e) {
    if (e instanceof GameError) return send(res, e.status, { error: e.message })
    console.error(e)
    send(res, 500, { error: 'Serverfehler' })
  }
}

// ----------------------------------------------------------- Statische App
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
}

async function serveStatic(res: ServerResponse, path: string) {
  const file = normalize(join(DIST, decodeURIComponent(path)))
  const inDist = file.startsWith(DIST + sep)
  const isFile = inDist && (await stat(file).then((s) => s.isFile(), () => false))
  const target = isFile ? file : join(DIST, 'index.html') // SPA-Fallback
  try {
    const data = await readFile(target)
    res.writeHead(200, {
      'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
      'Cache-Control': target.includes(`${join('dist', 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('App noch nicht gebaut – bitte "npm run build" ausführen.')
  }
}

const server = createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  const path = new URL(req.url ?? '/', 'http://x').pathname
  if (path.startsWith('/api/')) void handleApi(req, res, path)
  else void serveStatic(res, path)
}).listen(PORT, () => {
  console.log(`Martiniloben-Server läuft auf http://localhost:${PORT}  (Daten: ${DATA_DIR})`)
})

// Sauber beenden (Railway schickt SIGTERM bei jedem neuen Deploy)
function shutdown() {
  for (const res of clients) res.end()
  server.close(() => {
    db.close()
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 5_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
