import { createHttpApi } from './httpApi'
import type { Api } from './types'

export const api: Api = createHttpApi()

export const LEVELS = {
  1: { label: 'Leicht', points: 1 },
  2: { label: 'Mittel', points: 2 },
  3: { label: 'Schwer', points: 3 },
} as const

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
