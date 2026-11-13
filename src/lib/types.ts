import type { Level } from './missions'

export type CardKind = 'regular' | 'replacement'
export type CardStatus = 'active' | 'pending' | 'confirmed' | 'failed'
export type FailReason = 'gave_up' | 'rejected' | null

export interface PlayerPublic {
  id: number
  name: string
}

export interface Me extends PlayerPublic {
  isAdmin: boolean
  /** darf Ansagen an alle machen (Admin immer) */
  canAnnounce: boolean
}

export interface Session {
  token: string
  player: Me
}

export interface Draws {
  /** reguläre Ziehungen heute noch übrig */
  regularLeft: number
  /** Ersatz-Ziehungen für gescheiterte reguläre Karten */
  bonusLeft: number
  /** vom Admin geschenkte Extra-Karten (verfallen nicht) */
  extraLeft: number
}

export interface Settings {
  drawsPerDay: number
  paused: boolean
  announcement: string
  /** Name dessen, der die Ansage gemacht hat */
  announcementBy: string
  announcementAt: string | null
}

export interface LeaderRow {
  id: number
  name: string
  points: number
  done: number
  done1: number
  done2: number
  done3: number
  failed: number
}

export interface Card {
  id: number
  missionNo: number
  level: Level
  title: string
  description: string
  kind: CardKind
  isExtra: boolean
  status: CardStatus
  witnessId: number | null
  witnessName: string | null
  failReason: FailReason
  drawnAt: string
  resolvedAt: string | null
}

export interface Confirmation {
  id: number
  playerName: string
  level: Level
  title: string
  description: string
  reportedAt: string
}

export interface GameState {
  me: Me
  draws: Draws
  leaderboard: LeaderRow[]
  myCards: Card[]
  confirmations: Confirmation[]
  settings: Settings
}

export interface AdminPlayer extends Me {
  pin: string
  /** PIN ist fest im Server hinterlegt und kann nicht neu erzeugt werden */
  fixedPin: boolean
  draws: Draws
}

export interface AdminAssignment {
  id: number
  playerName: string
  title: string
  level: Level
  kind: CardKind
  isExtra: boolean
  status: CardStatus
  witnessName: string | null
  failReason: FailReason
  drawnAt: string
  resolvedAt: string | null
}

export interface AdminOverview {
  players: AdminPlayer[]
  assignments: AdminAssignment[]
  poolLeft: Record<string, number>
  settings: Settings
}

export interface Api {
  listPlayers(): Promise<PlayerPublic[]>
  login(playerId: number, pin: string): Promise<Session>
  logout(token: string): Promise<void>
  getState(token: string): Promise<GameState>
  drawCard(token: string, level: Level): Promise<void>
  reportDone(token: string, cardId: number, witnessId: number): Promise<void>
  giveUp(token: string, cardId: number): Promise<void>
  resolve(token: string, cardId: number, approve: boolean): Promise<void>
  adminOverview(token: string): Promise<AdminOverview>
  adminAddPlayer(token: string, name: string): Promise<{ id: number; pin: string }>
  adminResetPin(token: string, playerId: number): Promise<string>
  adminResetDraws(token: string, playerId: number | null): Promise<void>
  adminUpdateSettings(token: string, patch: Partial<Settings>): Promise<void>
  /** count darf negativ sein (Extra-Karten wieder wegnehmen) */
  adminGiveExtra(token: string, playerId: number, count: number): Promise<void>
  adminResolve(token: string, cardId: number, approve: boolean): Promise<void>
  /** Aktive/wartende Karte zurück in den Stapel (Ziehung wird erstattet) */
  adminReturnCard(token: string, cardId: number): Promise<void>
  adminDeletePlayer(token: string, playerId: number): Promise<void>
  /** Ansage-Recht für einen Spieler ein-/ausschalten */
  adminSetAnnouncer(token: string, playerId: number, allowed: boolean): Promise<void>
  /** Ansage an alle setzen (leer = entfernen); für Admin und freigeschaltete Spieler */
  announce(token: string, text: string): Promise<void>
  /** Neues Spiel: alle Karten zurück, Punkte auf 0, Spieler + PINs bleiben */
  adminResetGame(token: string): Promise<void>
  /** Ruft cb auf, sobald sich irgendwo im Spiel etwas ändert. */
  subscribe(cb: () => void): () => void
}

export class GameError extends Error {}
