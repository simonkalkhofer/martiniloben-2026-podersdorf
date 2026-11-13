import type { Api } from './types'
import { GameError } from './types'

/** Anbindung an den eigenen Server (server/index.ts). */
export function createHttpApi(base = ''): Api {
  async function call<T>(method: 'GET' | 'POST', path: string, token?: string, body?: unknown): Promise<T> {
    let res: Response
    try {
      res = await fetch(`${base}/api/${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new GameError('Keine Verbindung zum Server – Empfang prüfen.')
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new GameError(data?.error ?? `Fehler ${res.status}`)
    return data as T
  }

  return {
    listPlayers: () => call('GET', 'players'),
    login: (playerId, pin) => call('POST', 'login', undefined, { playerId, pin }),
    logout: (token) => call('POST', 'logout', token, {}),
    getState: (token) => call('GET', 'state', token),
    drawCard: (token, level) => call('POST', 'draw', token, { level }),
    reportDone: (token, cardId, witnessId) => call('POST', 'report', token, { cardId, witnessId }),
    giveUp: (token, cardId) => call('POST', 'give-up', token, { cardId }),
    resolve: (token, cardId, approve) => call('POST', 'resolve', token, { cardId, approve }),
    adminOverview: (token) => call('GET', 'admin/overview', token),
    adminAddPlayer: (token, name) => call('POST', 'admin/players', token, { name }),
    adminResetPin: (token, playerId) => call('POST', 'admin/reset-pin', token, { playerId }),
    adminResetDraws: (token, playerId) => call('POST', 'admin/reset-draws', token, { playerId }),
    adminUpdateSettings: (token, patch) => call('POST', 'admin/settings', token, patch),
    adminGiveExtra: (token, playerId, count) => call('POST', 'admin/give-extra', token, { playerId, count }),
    adminResolve: (token, cardId, approve) => call('POST', 'admin/resolve', token, { cardId, approve }),
    adminReturnCard: (token, cardId) => call('POST', 'admin/return-card', token, { cardId }),
    adminDeletePlayer: (token, playerId) => call('POST', 'admin/delete-player', token, { playerId }),
    adminResetGame: (token) => call('POST', 'admin/reset-game', token, {}),
    adminSetAnnouncer: (token, playerId, allowed) => call('POST', 'admin/announcer', token, { playerId, allowed }),
    announce: (token, text) => call('POST', 'announce', token, { text }),

    subscribe(cb) {
      // Server-Sent Events: der Server meldet jede Änderung, die App lädt dann neu.
      const events = new EventSource(`${base}/api/events`)
      let first = true
      events.onmessage = () => {
        if (first) { first = false; return }
        cb()
      }
      // Rückfall, falls die Verbindung im Weinkeller kurz weg ist
      const poll = window.setInterval(cb, 30_000)
      const onVisible = () => document.visibilityState === 'visible' && cb()
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        events.close()
        window.clearInterval(poll)
        document.removeEventListener('visibilitychange', onVisible)
      }
    },
  }
}
