// Erzeugt supabase/seed.sql aus src/lib/missions.ts (node scripts/gen-seed.ts)
import { writeFileSync } from 'node:fs'
import { MISSIONS, PLAYER_NAMES } from '../src/lib/missions.ts'

const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const lines = [
  '-- Automatisch erzeugt von scripts/gen-seed.ts – nicht von Hand bearbeiten.',
  '-- PINs werden beim Ausführen zufällig erzeugt und sind nur im Admin-Bereich sichtbar.',
  '',
  'insert into players (name, pin, is_admin) values',
  PLAYER_NAMES.map((n, i) => `  (${q(n)}, _random_pin(), ${i === 0})`).join(',\n'),
  'on conflict (name) do nothing;',
  '',
  'insert into missions (id, level, title, description) values',
  MISSIONS.map((m) => `  (${m.no}, ${m.level}, ${q(m.title)}, ${q(m.description)})`).join(',\n'),
  'on conflict (id) do update set level = excluded.level, title = excluded.title, description = excluded.description;',
  '',
]
writeFileSync(new URL('../supabase/seed.sql', import.meta.url), lines.join('\n'), 'utf8')
console.log(`seed.sql: ${PLAYER_NAMES.length} Spieler, ${MISSIONS.length} Missionen`)
