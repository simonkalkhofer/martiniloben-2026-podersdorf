import { createDemoApi } from './demoApi'
import { createSupabaseApi } from './supabaseApi'
import type { Api } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: Api = url && key ? createSupabaseApi(url, key) : createDemoApi()

export const LEVELS = {
  1: { label: 'Leicht', points: 1 },
  2: { label: 'Mittel', points: 2 },
  3: { label: 'Schwer', points: 3 },
} as const

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
