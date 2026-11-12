/**
 * Lokaler Demo-Modus: dieselbe Spiellogik wie supabase/schema.sql, aber im
 * localStorage dieses Browsers. Zum Ausprobieren ohne Supabase-Projekt –
 * NICHT für das echte Spiel (jedes Handy hätte seine eigene Datenbank).
 */
import { MISSIONS, PLAYER_NAMES, type Level } from './missions'
import type {
  AdminOverview, Api, Card, CardKind, CardStatus, Draws, FailReason, GameState, LeaderRow, Me,
} from './types'
import { GameError } from './types'

interface DbPlayer { id: number; name: string; pin: string; isAdmin: boolean; drawsResetAt: number }
interface DbAssignment {
  id: number; playerId: number; missionNo: number; kind: CardKind; replacesId: number | null
  status: CardStatus; witnessId: number | null; failReason: FailReason
  drawnAt: number; reportedAt: number | null; resolvedAt: number | null
}
interface Db { players: DbPlayer[]; assignments: DbAssignment[]; sessions: Record<string, number>; seq: number }

const KEY = 'martiniloben-demo-db-v1'
const randomPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0')
const viennaDay = (t: number) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
const iso = (t: number | null) => (t == null ? null : new Date(t).toISOString())

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch { /* neu anlegen */ }
  const db: Db = {
    players: PLAYER_NAMES.map((name, i) => ({
      id: i + 1, name, pin: randomPin(), isAdmin: i === 0, drawsResetAt: 0,
    })),
    assignments: [], sessions: {}, seq: 1,
  }
  save(db)
  return db
}

const listeners = new Set<() => void>()
function save(db: Db) {
  localStorage.setItem(KEY, JSON.stringify(db))
  listeners.forEach((l) => l())
}

function me(db: Db, token: string): DbPlayer {
  const p = db.players.find((x) => x.id === db.sessions[token])
  if (!p) throw new GameError('Nicht angemeldet')
  return p
}
function admin(db: Db, token: string) {
  const p = me(db, token)
  if (!p.isAdmin) throw new GameError('Nur für Admins')
  return p
}
const mission = (no: number) => MISSIONS[no - 1]
const toMe = (p: DbPlayer): Me => ({ id: p.id, name: p.name, isAdmin: p.isAdmin })

function unusedFailedRegular(db: Db, p: DbPlayer) {
  return db.assignments
    .filter((a) => a.playerId === p.id && a.kind === 'regular' && a.status === 'failed'
      && !db.assignments.some((r) => r.replacesId === a.id))
    .sort((a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0))
}

function draws(db: Db, p: DbPlayer): Draws {
  const today = viennaDay(Date.now())
  const usedToday = db.assignments.filter((a) => a.playerId === p.id && a.kind === 'regular'
    && viennaDay(a.drawnAt) === today && a.drawnAt >= p.drawsResetAt).length
  return { regularLeft: Math.max(0, 2 - usedToday), bonusLeft: unusedFailedRegular(db, p).length }
}

const delay = () => new Promise((r) => setTimeout(r, 120))

export function createDemoApi(): Api {
  window.addEventListener('storage', (e) => e.key === KEY && listeners.forEach((l) => l()))

  return {
    mode: 'demo',
    async listPlayers() {
      return load().players.map(({ id, name }) => ({ id, name }))
    },
    async login(playerId, pin) {
      await delay()
      const db = load()
      const p = db.players.find((x) => x.id === playerId)
      if (!p) throw new GameError('Unbekannter Spieler')
      if (p.pin !== pin) throw new GameError('Falscher PIN')
      const token = crypto.randomUUID()
      db.sessions[token] = p.id
      save(db)
      return { token, player: toMe(p) }
    },
    async logout(token) {
      const db = load()
      delete db.sessions[token]
      save(db)
    },
    async getState(token): Promise<GameState> {
      const db = load()
      const p = me(db, token)
      const name = (id: number | null) => db.players.find((x) => x.id === id)?.name ?? null
      const leaderboard: LeaderRow[] = db.players.map((pl) => {
        const mine = db.assignments.filter((a) => a.playerId === pl.id)
        const ok = mine.filter((a) => a.status === 'confirmed').map((a) => mission(a.missionNo).level)
        return {
          id: pl.id, name: pl.name,
          points: ok.reduce<number>((s, l) => s + l, 0), done: ok.length,
          done1: ok.filter((l) => l === 1).length, done2: ok.filter((l) => l === 2).length,
          done3: ok.filter((l) => l === 3).length,
          failed: mine.filter((a) => a.status === 'failed').length,
        }
      }).sort((a, b) => b.points - a.points || b.done - a.done || a.name.localeCompare(b.name))

      const myCards: Card[] = db.assignments.filter((a) => a.playerId === p.id)
        .sort((a, b) => b.drawnAt - a.drawnAt)
        .map((a) => {
          const m = mission(a.missionNo)
          return {
            id: a.id, missionNo: m.no, level: m.level, title: m.title, description: m.description,
            kind: a.kind, status: a.status, witnessId: a.witnessId, witnessName: name(a.witnessId),
            failReason: a.failReason, drawnAt: iso(a.drawnAt)!, resolvedAt: iso(a.resolvedAt),
          }
        })
      const confirmations = db.assignments
        .filter((a) => a.witnessId === p.id && a.status === 'pending')
        .sort((a, b) => (a.reportedAt ?? 0) - (b.reportedAt ?? 0))
        .map((a) => {
          const m = mission(a.missionNo)
          return { id: a.id, playerName: name(a.playerId)!, level: m.level, title: m.title,
            description: m.description, reportedAt: iso(a.reportedAt)! }
        })
      return { me: toMe(p), draws: draws(db, p), leaderboard, myCards, confirmations }
    },
    async drawCard(token, level: Level) {
      await delay()
      const db = load()
      const p = me(db, token)
      const d = draws(db, p)
      let kind: CardKind
      let replacesId: number | null = null
      if (d.regularLeft > 0) kind = 'regular'
      else if (d.bonusLeft > 0) { kind = 'replacement'; replacesId = unusedFailedRegular(db, p)[0].id }
      else throw new GameError('Heute keine Ziehungen mehr übrig.')

      const pool = MISSIONS.filter((m) => m.level === level)
      let candidates = pool.filter((m) => !db.assignments.some((a) => a.missionNo === m.no))
      if (!candidates.length) {
        candidates = pool.filter((m) => !db.assignments.some((a) => a.missionNo === m.no && a.playerId === p.id))
      }
      if (!candidates.length) throw new GameError('In dieser Stufe sind keine Karten mehr übrig.')
      const m = candidates[Math.floor(Math.random() * candidates.length)]
      db.assignments.push({
        id: db.seq++, playerId: p.id, missionNo: m.no, kind, replacesId, status: 'active',
        witnessId: null, failReason: null, drawnAt: Date.now(), reportedAt: null, resolvedAt: null,
      })
      save(db)
    },
    async reportDone(token, cardId, witnessId) {
      const db = load()
      const p = me(db, token)
      if (witnessId === p.id || !db.players.some((x) => x.id === witnessId)) throw new GameError('Ungültiger Zeuge')
      const a = db.assignments.find((x) => x.id === cardId && x.playerId === p.id && x.status === 'active')
      if (!a) throw new GameError('Karte ist nicht mehr aktiv')
      Object.assign(a, { status: 'pending', witnessId, reportedAt: Date.now() })
      save(db)
    },
    async giveUp(token, cardId) {
      const db = load()
      const p = me(db, token)
      const a = db.assignments.find((x) => x.id === cardId && x.playerId === p.id
        && (x.status === 'active' || x.status === 'pending'))
      if (!a) throw new GameError('Karte ist nicht mehr aktiv')
      Object.assign(a, { status: 'failed', failReason: 'gave_up', resolvedAt: Date.now() })
      save(db)
    },
    async resolve(token, cardId, approve) {
      const db = load()
      const p = me(db, token)
      const a = db.assignments.find((x) => x.id === cardId && x.witnessId === p.id && x.status === 'pending')
      if (!a) throw new GameError('Anfrage existiert nicht mehr')
      Object.assign(a, approve
        ? { status: 'confirmed', failReason: null, resolvedAt: Date.now() }
        : { status: 'failed', failReason: 'rejected', resolvedAt: Date.now() })
      save(db)
    },
    async adminOverview(token): Promise<AdminOverview> {
      const db = load()
      admin(db, token)
      const name = (id: number | null) => db.players.find((x) => x.id === id)?.name ?? null
      const poolLeft: Record<string, number> = {}
      for (const l of [1, 2, 3]) {
        poolLeft[l] = MISSIONS.filter((m) => m.level === l
          && !db.assignments.some((a) => a.missionNo === m.no)).length
      }
      return {
        players: db.players.map((p) => ({ ...toMe(p), pin: p.pin, draws: draws(db, p) })),
        assignments: [...db.assignments].sort((a, b) => b.drawnAt - a.drawnAt).map((a) => {
          const m = mission(a.missionNo)
          return { id: a.id, playerName: name(a.playerId)!, title: m.title, level: m.level, kind: a.kind,
            status: a.status, witnessName: name(a.witnessId), failReason: a.failReason,
            drawnAt: iso(a.drawnAt)!, resolvedAt: iso(a.resolvedAt) }
        }),
        poolLeft,
      }
    },
    async adminAddPlayer(token, rawName) {
      const db = load()
      admin(db, token)
      const name = rawName.trim()
      if (!name) throw new GameError('Name fehlt')
      if (db.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new GameError('Name existiert bereits')
      const p: DbPlayer = { id: Math.max(...db.players.map((x) => x.id)) + 1, name, pin: randomPin(),
        isAdmin: false, drawsResetAt: 0 }
      db.players.push(p)
      save(db)
      return { id: p.id, pin: p.pin }
    },
    async adminResetPin(token, playerId) {
      const db = load()
      admin(db, token)
      const p = db.players.find((x) => x.id === playerId)
      if (!p) throw new GameError('Unbekannter Spieler')
      p.pin = randomPin()
      for (const [t, id] of Object.entries(db.sessions)) if (id === playerId) delete db.sessions[t]
      save(db)
      return p.pin
    },
    async adminResetDraws(token, playerId) {
      const db = load()
      admin(db, token)
      const now = Date.now()
      db.players.forEach((p) => { if (playerId == null || p.id === playerId) p.drawsResetAt = now })
      save(db)
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

/** Nur im Demo-Modus: PIN des Admins für den ersten Login anzeigen. */
export function demoAdminPin(): string {
  return load().players.find((p) => p.isAdmin)?.pin ?? ''
}
