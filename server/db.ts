/**
 * SQLite-Datenbank (eingebaut in Node ≥ 22, kein Zusatzpaket).
 * Beim ersten Start werden die 10 Spieler mit zufälligen PINs angelegt;
 * die 90 Missionen werden bei jedem Start aus src/lib/missions.ts aktualisiert.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomInt } from 'node:crypto'
import { MISSIONS, PLAYER_NAMES } from '../src/lib/missions.ts'

const ADMIN_PIN = '1413'

export const randomPin =() => String(randomInt(0, 10000)).padStart(4, '0')

export function openDb(dataDir: string): DatabaseSync {
  mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(join(dataDir, 'martiniloben.sqlite'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS players (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL UNIQUE COLLATE NOCASE,
      pin            TEXT NOT NULL,
      is_admin       INTEGER NOT NULL DEFAULT 0,
      draws_reset_at INTEGER NOT NULL DEFAULT 0,
      failed_logins  INTEGER NOT NULL DEFAULT 0,
      locked_until   INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS missions (
      id          INTEGER PRIMARY KEY,
      level       INTEGER NOT NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      mission_id  INTEGER NOT NULL REFERENCES missions(id),
      kind        TEXT NOT NULL CHECK (kind IN ('regular', 'replacement')),
      replaces_id INTEGER UNIQUE REFERENCES assignments(id),
      status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'confirmed', 'failed')),
      witness_id  INTEGER REFERENCES players(id),
      fail_reason TEXT CHECK (fail_reason IN ('gave_up', 'rejected')),
      drawn_at    INTEGER NOT NULL,
      reported_at INTEGER,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS assignments_player  ON assignments(player_id);
    CREATE INDEX IF NOT EXISTS assignments_witness ON assignments(witness_id, status);

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES ('draws_per_day', '2'), ('paused', '0'), ('announcement', '');
  `)

  // Spalten, die nach der ersten Version dazugekommen sind (bestehende Datenbanken erweitern)
  const addColumn = (table: string, column: string, ddl: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
  addColumn('players', 'extra_draws', 'extra_draws INTEGER NOT NULL DEFAULT 0')
  addColumn('assignments', 'is_extra', 'is_extra INTEGER NOT NULL DEFAULT 0')

  const upsertMission = db.prepare(`
    INSERT INTO missions (id, level, title, description) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET level = excluded.level, title = excluded.title, description = excluded.description`)
  for (const m of MISSIONS) upsertMission.run(m.no, m.level, m.title, m.description)

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }
  if (n === 0) {
    const insert = db.prepare('INSERT INTO players (name, pin, is_admin) VALUES (?, ?, ?)')
    PLAYER_NAMES.forEach((name, i) => insert.run(name, randomPin(), i === 0 ? 1 : 0))
  }

  // Admin (Simon) hat einen festen PIN – wird bei jedem Start gesetzt.
  // Überschreibbar mit der Umgebungsvariable ADMIN_PIN.
  const adminPin = /^\d{4}$/.test(process.env.ADMIN_PIN ?? '') ? process.env.ADMIN_PIN! : ADMIN_PIN
  db.prepare('UPDATE players SET pin = ?, failed_logins = 0, locked_until = NULL WHERE name = ?')
    .run(adminPin, PLAYER_NAMES[0])
  return db
}
