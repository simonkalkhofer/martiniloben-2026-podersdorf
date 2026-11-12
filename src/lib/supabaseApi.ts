import { createClient } from '@supabase/supabase-js'
import type { Api, Session } from './types'
import { GameError } from './types'

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey, { auth: { persistSession: false } })

  async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await sb.rpc(fn, args)
    if (error) throw new GameError(error.message)
    return data as T
  }

  return {
    mode: 'supabase',
    listPlayers: () => rpc('list_players'),
    async login(playerId, pin) {
      const res = await rpc<Session | { error: string }>('login', { p_player_id: playerId, p_pin: pin })
      if ('error' in res) throw new GameError(res.error)
      return res
    },
    logout: (token) => rpc('logout', { p_token: token }),
    getState: (token) => rpc('get_state', { p_token: token }),
    drawCard: (token, level) => rpc('draw_card', { p_token: token, p_level: level }),
    reportDone: (token, cardId, witnessId) =>
      rpc('report_done', { p_token: token, p_assignment_id: cardId, p_witness_id: witnessId }),
    giveUp: (token, cardId) => rpc('give_up', { p_token: token, p_assignment_id: cardId }),
    resolve: (token, cardId, approve) =>
      rpc('resolve_confirmation', { p_token: token, p_assignment_id: cardId, p_approve: approve }),
    adminOverview: (token) => rpc('admin_overview', { p_token: token }),
    adminAddPlayer: (token, name) => rpc('admin_add_player', { p_token: token, p_name: name }),
    adminResetPin: (token, playerId) => rpc('admin_reset_pin', { p_token: token, p_player_id: playerId }),
    adminResetDraws: (token, playerId) =>
      rpc('admin_reset_draws', { p_token: token, p_player_id: playerId }),

    subscribe(cb) {
      const channel = sb
        .channel('app_state')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state' }, () => cb())
        .subscribe()
      // Fallback, falls Realtime (z. B. im Funkloch im Weinkeller) kurz weg ist
      const poll = window.setInterval(cb, 20_000)
      const onVisible = () => document.visibilityState === 'visible' && cb()
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        window.clearInterval(poll)
        document.removeEventListener('visibilitychange', onVisible)
        void sb.removeChannel(channel)
      }
    },
  }
}
