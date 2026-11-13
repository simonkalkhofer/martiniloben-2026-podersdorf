/**
 * Gesamte Spiellogik. Alle Funktionen sind synchron – Node arbeitet Anfragen
 * nacheinander ab, dadurch kann z. B. niemand durch Doppelklick zweimal ziehen.
 */
import type { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { randomPin } from './db.ts'
import type {
  AdminOverview, Card, CardKind, CardStatus, Confirmation, Draws, FailReason, GameState, LeaderRow, Me,
  PlayerPublic, Session, Settings,
} from '../src/lib/types.ts'
import type { Level } from '../src/lib/missions.ts'

export class GameError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

interface PlayerRow {
  id: number; name: string; pin: string; is_admin: number
  draws_reset_at: number; failed_logins: number; locked_until: number | null; extra_draws: number
  can_announce: number
}
interface CardRow {
  id: number; player_id: number; mission_id: number; level: Level; title: string; description: string
  kind: CardKind; is_extra: number; status: CardStatus; witness_id: number | null; witness_name: string | null
  fail_reason: FailReason; drawn_at: number; reported_at: number | null; resolved_at: number | null
  player_name: string
}

const LOCK_AFTER = 5
const LOCK_MS = 5 * 60_000
const iso = (t: number | null) => (t == null ? null : new Date(t).toISOString())
const viennaDay = (t: number) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
const toMe = (p: PlayerRow): Me => ({
  id: p.id, name: p.name, isAdmin: p.is_admin === 1, canAnnounce: p.is_admin === 1 || p.can_announce === 1,
})

const CARD_SELECT = `
  SELECT a.*, m.level, m.title, m.description, w.name AS witness_name, pl.name AS player_name
  FROM assignments a
  JOIN missions m ON m.id = a.mission_id
  JOIN players pl ON pl.id = a.player_id
  LEFT JOIN players w ON w.id = a.witness_id`

export function createGame(db: DatabaseSync, onChange: () => void) {
  const q = {
    player: db.prepare('SELECT * FROM players WHERE id = ?'),
    sessionPlayer: db.prepare('SELECT p.* FROM sessions s JOIN players p ON p.id = s.player_id WHERE s.token = ?'),
    unusedFailed: db.prepare(`
      SELECT a.id FROM assignments a
      WHERE a.player_id = ? AND a.kind = 'regular' AND a.status = 'failed'
        AND NOT EXISTS (SELECT 1 FROM assignments r WHERE r.replaces_id = a.id)
      ORDER BY a.resolved_at`),
    regularSince: db.prepare(`
      SELECT drawn_at FROM assignments WHERE player_id = ? AND kind = 'regular' AND is_extra = 0 AND drawn_at >= ?`),
    setting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
  }

  function settings(): Settings {
    const get = (k: string) => (q.setting.get(k) as { value: string } | undefined)?.value ?? ''
    return {
      drawsPerDay: Number(get('draws_per_day') || 2),
      paused: get('paused') === '1',
      announcement: get('announcement'),
      announcementBy: get('announcement_by'),
      announcementAt: get('announcement_at') ? new Date(Number(get('announcement_at'))).toISOString() : null,
    }
  }

  function setAnnouncement(text: string, by: string) {
    const clean = String(text ?? '').trim().slice(0, 200)
    q.setSetting.run('announcement', clean)
    q.setSetting.run('announcement_by', clean ? by : '')
    q.setSetting.run('announcement_at', clean ? String(Date.now()) : '')
  }

  function me(token: string | undefined): PlayerRow {
    const p = token ? (q.sessionPlayer.get(token) as PlayerRow | undefined) : undefined
    if (!p) throw new GameError('Nicht angemeldet', 401)
    return p
  }
  function admin(token: string | undefined): PlayerRow {
    const p = me(token)
    if (!p.is_admin) throw new GameError('Nur für Admins', 403)
    return p
  }

  function draws(p: PlayerRow): Draws {
    const today = viennaDay(Date.now())
    const since = Math.max(p.draws_reset_at, Date.now() - 2 * 86_400_000)
    const usedToday = (q.regularSince.all(p.id, since) as { drawn_at: number }[])
      .filter((r) => viennaDay(r.drawn_at) === today).length
    return {
      regularLeft: Math.max(0, settings().drawsPerDay - usedToday),
      bonusLeft: q.unusedFailed.all(p.id).length,
      extraLeft: p.extra_draws,
    }
  }

  function toCard(r: CardRow): Card {
    return {
      id: r.id, missionNo: r.mission_id, level: r.level, title: r.title, description: r.description,
      kind: r.kind, isExtra: r.is_extra === 1, status: r.status, witnessId: r.witness_id, witnessName: r.witness_name,
      failReason: r.fail_reason, drawnAt: iso(r.drawn_at)!, resolvedAt: iso(r.resolved_at),
    }
  }

  /** Schreibende Aktion in einer Transaktion; danach alle Clients benachrichtigen. */
  function mutate<T>(fn: () => T): T {
    db.exec('BEGIN')
    try {
      const res = fn()
      db.exec('COMMIT')
      onChange()
      return res
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  return {
    listPlayers(): PlayerPublic[] {
      return db.prepare('SELECT id, name FROM players ORDER BY id').all() as unknown as PlayerPublic[]
    },

    login(playerId: number, pin: string): Session {
      const p = q.player.get(playerId) as PlayerRow | undefined
      if (!p) throw new GameError('Unbekannter Spieler')
      if (p.locked_until && p.locked_until > Date.now()) {
        throw new GameError('Zu viele Fehlversuche – bitte in ein paar Minuten nochmal.', 429)
      }
      if (p.pin !== String(pin)) {
        const fails = p.failed_logins + 1
        db.prepare('UPDATE players SET failed_logins = ?, locked_until = ? WHERE id = ?')
          .run(fails >= LOCK_AFTER ? 0 : fails, fails >= LOCK_AFTER ? Date.now() + LOCK_MS : p.locked_until, p.id)
        throw new GameError('Falscher PIN')
      }
      db.prepare('UPDATE players SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(p.id)
      const token = randomUUID()
      db.prepare('INSERT INTO sessions (token, player_id, created_at) VALUES (?, ?, ?)').run(token, p.id, Date.now())
      return { token, player: toMe(p) }
    },

    logout(token: string | undefined) {
      if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    },

    getState(token: string | undefined): GameState {
      const p = me(token)
      const leaderboard = (db.prepare(`
        SELECT pl.id, pl.name,
          COALESCE(SUM(CASE WHEN a.status = 'confirmed' THEN m.level END), 0) AS points,
          COUNT(CASE WHEN a.status = 'confirmed' THEN 1 END) AS done,
          COUNT(CASE WHEN a.status = 'confirmed' AND m.level = 1 THEN 1 END) AS done1,
          COUNT(CASE WHEN a.status = 'confirmed' AND m.level = 2 THEN 1 END) AS done2,
          COUNT(CASE WHEN a.status = 'confirmed' AND m.level = 3 THEN 1 END) AS done3,
          COUNT(CASE WHEN a.status = 'failed' THEN 1 END) AS failed
        FROM players pl
        LEFT JOIN assignments a ON a.player_id = pl.id
        LEFT JOIN missions m ON m.id = a.mission_id
        GROUP BY pl.id
        ORDER BY points DESC, done DESC, pl.name COLLATE NOCASE`).all() as unknown as LeaderRow[])
      const myCards = (db.prepare(`${CARD_SELECT} WHERE a.player_id = ? ORDER BY a.drawn_at DESC, a.id DESC`)
        .all(p.id) as unknown as CardRow[]).map(toCard)
      const confirmations: Confirmation[] = (db.prepare(
        `${CARD_SELECT} WHERE a.witness_id = ? AND a.status = 'pending' ORDER BY a.reported_at`,
      ).all(p.id) as unknown as CardRow[]).map((r) => ({
        id: r.id, playerName: r.player_name, level: r.level, title: r.title,
        description: r.description, reportedAt: iso(r.reported_at)!,
      }))
      return { me: toMe(p), draws: draws(p), leaderboard, myCards, confirmations, settings: settings() }
    },

    drawCard(token: string | undefined, level: number) {
      const p = me(token)
      if (![1, 2, 3].includes(level)) throw new GameError('Ungültige Stufe')
      if (settings().paused) throw new GameError('Das Ziehen ist gerade pausiert. ⏸️')
      const d = draws(p)
      let kind: CardKind
      let replacesId: number | null = null
      let isExtra = 0
      // Reihenfolge: reguläre (verfallen um Mitternacht) → Ersatz → Extra-Karten vom Admin
      if (d.regularLeft > 0) kind = 'regular'
      else if (d.bonusLeft > 0) {
        kind = 'replacement'
        replacesId = (q.unusedFailed.get(p.id) as { id: number }).id
      } else if (d.extraLeft > 0) {
        kind = 'regular'
        isExtra = 1
      } else throw new GameError('Heute keine Ziehungen mehr übrig.')

      // 1. Wahl: Karte, die noch niemand hatte – 2. Wahl: Karte, die dieser Spieler noch nie hatte
      const pick = (db.prepare(`
        SELECT id FROM missions m WHERE level = ?
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.mission_id = m.id)
        ORDER BY random() LIMIT 1`).get(level)
        ?? db.prepare(`
        SELECT id FROM missions m WHERE level = ?
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.mission_id = m.id AND a.player_id = ?)
        ORDER BY random() LIMIT 1`).get(level, p.id)) as { id: number } | undefined
      if (!pick) throw new GameError('In dieser Stufe sind keine Karten mehr übrig.')

      mutate(() => {
        db.prepare(`
          INSERT INTO assignments (player_id, mission_id, kind, replaces_id, is_extra, drawn_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .run(p.id, pick.id, kind, replacesId, isExtra, Date.now())
        if (isExtra) db.prepare('UPDATE players SET extra_draws = extra_draws - 1 WHERE id = ?').run(p.id)
      })
    },

    reportDone(token: string | undefined, cardId: number, witnessId: number) {
      const p = me(token)
      if (witnessId === p.id || !q.player.get(witnessId)) throw new GameError('Ungültiger Zeuge')
      mutate(() => {
        const r = db.prepare(`UPDATE assignments SET status = 'pending', witness_id = ?, reported_at = ?
          WHERE id = ? AND player_id = ? AND status = 'active'`).run(witnessId, Date.now(), cardId, p.id)
        if (!r.changes) throw new GameError('Karte ist nicht mehr aktiv')
      })
    },

    giveUp(token: string | undefined, cardId: number) {
      const p = me(token)
      mutate(() => {
        const r = db.prepare(`UPDATE assignments SET status = 'failed', fail_reason = 'gave_up', resolved_at = ?
          WHERE id = ? AND player_id = ? AND status IN ('active', 'pending')`).run(Date.now(), cardId, p.id)
        if (!r.changes) throw new GameError('Karte ist nicht mehr aktiv')
      })
    },

    resolve(token: string | undefined, cardId: number, approve: boolean) {
      const p = me(token)
      mutate(() => {
        const r = db.prepare(`UPDATE assignments SET status = ?, fail_reason = ?, resolved_at = ?
          WHERE id = ? AND witness_id = ? AND status = 'pending'`)
          .run(approve ? 'confirmed' : 'failed', approve ? null : 'rejected', Date.now(), cardId, p.id)
        if (!r.changes) throw new GameError('Anfrage existiert nicht mehr')
      })
    },

    adminOverview(token: string | undefined): AdminOverview {
      admin(token)
      const players = (db.prepare('SELECT * FROM players ORDER BY id').all() as unknown as PlayerRow[])
        .map((p) => ({ ...toMe(p), pin: p.pin, draws: draws(p) }))
      const assignments = (db.prepare(`${CARD_SELECT} ORDER BY a.drawn_at DESC, a.id DESC`).all() as unknown as CardRow[])
        .map((r) => ({
          id: r.id, playerName: r.player_name, title: r.title, level: r.level, kind: r.kind,
          isExtra: r.is_extra === 1, status: r.status,
          witnessName: r.witness_name, failReason: r.fail_reason, drawnAt: iso(r.drawn_at)!, resolvedAt: iso(r.resolved_at),
        }))
      const poolLeft: Record<string, number> = {}
      for (const row of db.prepare(`
        SELECT level, COUNT(*) AS n FROM missions m
        WHERE NOT EXISTS (SELECT 1 FROM assignments a WHERE a.mission_id = m.id) GROUP BY level`).all() as { level: number; n: number }[]) {
        poolLeft[row.level] = row.n
      }
      return { players, assignments, poolLeft, settings: settings() }
    },

    adminAddPlayer(token: string | undefined, rawName: string) {
      admin(token)
      const name = String(rawName ?? '').trim().slice(0, 24)
      if (!name) throw new GameError('Name fehlt')
      if (db.prepare('SELECT 1 FROM players WHERE name = ?').get(name)) throw new GameError('Name existiert bereits')
      const pin = randomPin()
      const id = mutate(() => Number(db.prepare('INSERT INTO players (name, pin) VALUES (?, ?)').run(name, pin).lastInsertRowid))
      return { id, pin }
    },

    adminResetPin(token: string | undefined, playerId: number) {
      admin(token)
      if (!q.player.get(playerId)) throw new GameError('Unbekannter Spieler')
      const pin = randomPin()
      mutate(() => {
        db.prepare('UPDATE players SET pin = ?, failed_logins = 0, locked_until = NULL WHERE id = ?').run(pin, playerId)
        db.prepare('DELETE FROM sessions WHERE player_id = ?').run(playerId) // alte Logins ungültig
      })
      return pin
    },

    adminResetDraws(token: string | undefined, playerId: number | null) {
      admin(token)
      mutate(() => {
        if (playerId == null) db.prepare('UPDATE players SET draws_reset_at = ?').run(Date.now())
        else db.prepare('UPDATE players SET draws_reset_at = ? WHERE id = ?').run(Date.now(), playerId)
      })
    },

    announce(token: string | undefined, text: string) {
      const p = me(token)
      if (!toMe(p).canAnnounce) throw new GameError('Du darfst keine Ansagen machen', 403)
      mutate(() => setAnnouncement(text, p.name))
    },

    adminSetAnnouncer(token: string | undefined, playerId: number, allowed: boolean) {
      admin(token)
      if (!q.player.get(playerId)) throw new GameError('Unbekannter Spieler')
      mutate(() => db.prepare('UPDATE players SET can_announce = ? WHERE id = ?').run(allowed ? 1 : 0, playerId))
    },

    adminUpdateSettings(token: string | undefined, patch: Partial<Settings>) {
      const self = admin(token)
      mutate(() => {
        if (patch.drawsPerDay !== undefined) {
          const n = Math.trunc(Number(patch.drawsPerDay))
          if (!(n >= 0 && n <= 10)) throw new GameError('Ziehungen pro Tag: 0 bis 10')
          q.setSetting.run('draws_per_day', String(n))
        }
        if (patch.paused !== undefined) q.setSetting.run('paused', patch.paused ? '1' : '0')
        if (patch.announcement !== undefined) setAnnouncement(patch.announcement, self.name)
      })
    },

    adminGiveExtra(token: string | undefined, playerId: number, count: number) {
      admin(token)
      const n = Math.trunc(Number(count))
      if (!n || Math.abs(n) > 10) throw new GameError('Anzahl: -10 bis 10')
      if (!q.player.get(playerId)) throw new GameError('Unbekannter Spieler')
      mutate(() => db.prepare('UPDATE players SET extra_draws = MAX(0, extra_draws + ?) WHERE id = ?').run(n, playerId))
    },

    adminResolve(token: string | undefined, cardId: number, approve: boolean) {
      admin(token)
      mutate(() => {
        const r = db.prepare(`UPDATE assignments SET status = ?, fail_reason = ?, resolved_at = ?
          WHERE id = ? AND status = 'pending'`)
          .run(approve ? 'confirmed' : 'failed', approve ? null : 'rejected', Date.now(), cardId)
        if (!r.changes) throw new GameError('Karte wartet nicht (mehr) auf Bestätigung')
      })
    },

    adminReturnCard(token: string | undefined, cardId: number) {
      admin(token)
      mutate(() => {
        const a = db.prepare(`SELECT player_id, is_extra FROM assignments WHERE id = ? AND status IN ('active', 'pending')`)
          .get(cardId) as { player_id: number; is_extra: number } | undefined
        if (!a) throw new GameError('Nur laufende Karten können zurückgelegt werden')
        db.prepare('DELETE FROM assignments WHERE id = ?').run(cardId)
        // Extra-Karte zurückgeben; eine reguläre Ziehung von heute zählt automatisch nicht mehr
        if (a.is_extra) db.prepare('UPDATE players SET extra_draws = extra_draws + 1 WHERE id = ?').run(a.player_id)
      })
    },

    adminDeletePlayer(token: string | undefined, playerId: number) {
      const self = admin(token)
      const p = q.player.get(playerId) as PlayerRow | undefined
      if (!p) throw new GameError('Unbekannter Spieler')
      if (p.is_admin || p.id === self.id) throw new GameError('Der Admin kann nicht entfernt werden')
      mutate(() => {
        // Wartet jemand auf diesen Zeugen → Karte wieder aktiv, damit ein anderer Zeuge gewählt werden kann
        db.prepare(`UPDATE assignments SET status = 'active', witness_id = NULL, reported_at = NULL
          WHERE witness_id = ? AND status = 'pending'`).run(playerId)
        db.prepare('UPDATE assignments SET witness_id = NULL WHERE witness_id = ?').run(playerId)
        db.prepare('UPDATE assignments SET replaces_id = NULL WHERE player_id = ?').run(playerId)
        db.prepare('DELETE FROM assignments WHERE player_id = ?').run(playerId)
        db.prepare('DELETE FROM players WHERE id = ?').run(playerId)
      })
    },

    adminResetGame(token: string | undefined) {
      admin(token)
      mutate(() => {
        db.prepare('DELETE FROM assignments').run()
        db.prepare('UPDATE players SET extra_draws = 0, draws_reset_at = 0').run()
      })
    },
  }
}

export type Game = ReturnType<typeof createGame>
