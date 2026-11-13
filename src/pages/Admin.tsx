import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { api, errorText, LEVELS } from '../lib/api'
import type { AdminOverview, AdminPlayer, CardStatus } from '../lib/types'
import type { PageProps } from '../App'

const STATUS_LABEL: Record<CardStatus, string> = {
  active: '🃏 läuft',
  pending: '⏳ wartet',
  confirmed: '✅ erledigt',
  failed: '❌ gescheitert',
}

const RESET_WORD = 'NEU'

type Filter = 'all' | 'open' | 'confirmed' | 'failed'
type Confirm = { title?: string; text: string; action: () => Promise<unknown>; ok: string; danger?: boolean }

export default function Admin({ token, state, onBack }: PageProps & { onBack: () => void }) {
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<AdminOverview | null>(null)
  const [showPins, setShowPins] = useState(false)
  const [newName, setNewName] = useState('')
  const [filter, setFilter] = useState<Filter>('open')
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [playerId, setPlayerId] = useState<number | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetWord, setResetWord] = useState('')

  const load = useCallback(async () => {
    try {
      const d = await api.adminOverview(token)
      setData(d)
      return d
    } catch (e) {
      toast(errorText(e))
    }
  }, [token, toast])

  // bei jeder Spieländerung (state kommt live rein) neu laden
  useEffect(() => { void load() }, [load, state])
  // Ansage-Feld einmalig mit dem gespeicherten Text füllen
  const announcementLoaded = useRef(false)
  useEffect(() => {
    if (data && !announcementLoaded.current) {
      setAnnouncement(data.settings.announcement)
      announcementLoaded.current = true
    }
  }, [data])

  useGSAP(() => {
    if (data) gsap.from('.adm-section', { y: 16, autoAlpha: 0, stagger: 0.07, clearProps: 'transform,opacity,visibility' })
  }, { scope: root, dependencies: [data === null] })

  async function run(action: () => Promise<unknown>, ok: string) {
    try {
      await action()
      await load()
      toast(ok)
    } catch (e) {
      toast(errorText(e))
    }
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    try {
      const res = await api.adminAddPlayer(token, name)
      setNewName('')
      setShowPins(true)
      await load()
      toast(`${name} angelegt – PIN ${res.pin}`)
    } catch (err) {
      toast(errorText(err))
    }
  }

  if (!data) {
    return (
      <div className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <button onClick={onBack} className="text-sm font-semibold text-gold-300">← Zurück</button>
        <p className="mt-6 animate-pulse text-cream-300">Lade …</p>
      </div>
    )
  }

  const s = data.settings
  const selected: AdminPlayer | undefined = data.players.find((p) => p.id === playerId)
  const assignments = data.assignments.filter((a) =>
    filter === 'all' ? true
      : filter === 'open' ? a.status === 'active' || a.status === 'pending'
      : a.status === filter)
  const counts = {
    open: data.assignments.filter((a) => a.status === 'active' || a.status === 'pending').length,
    confirmed: data.assignments.filter((a) => a.status === 'confirmed').length,
    failed: data.assignments.filter((a) => a.status === 'failed').length,
  }
  const setDraws = (n: number) =>
    run(() => api.adminUpdateSettings(token, { drawsPerDay: n }), `Ab sofort ${n} Ziehung${n === 1 ? '' : 'en'} pro Tag`)

  return (
    <div ref={root} className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-6">
      <button onClick={onBack} className="text-sm font-semibold text-gold-300">← Zurück</button>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-cream-100">Admin-Bereich</h1>
      <p className="mt-1 text-sm text-cream-300/80">Nur für dich sichtbar, {state.me.name}.</p>

      {/* ------------------------------------------------ Spielsteuerung */}
      <section className="adm-section card-surface mt-5 space-y-5 p-4">
        <h2 className="font-display text-xl font-semibold text-cream-100">Spielsteuerung</h2>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-cream-100">Karten pro Tag</p>
            <p className="text-xs text-cream-300/70">reguläre Ziehungen je Spieler</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-11 w-11 place-items-center rounded-xl bg-ink-700 text-xl" disabled={s.drawsPerDay <= 0}
              onClick={() => setDraws(s.drawsPerDay - 1)} aria-label="Weniger">−</button>
            <span className="w-8 text-center font-display text-2xl font-extrabold text-gold-300">{s.drawsPerDay}</span>
            <button className="grid h-11 w-11 place-items-center rounded-xl bg-ink-700 text-xl" disabled={s.drawsPerDay >= 10}
              onClick={() => setDraws(s.drawsPerDay + 1)} aria-label="Mehr">+</button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-cream-100">Ziehen {s.paused ? 'pausiert' : 'erlaubt'}</p>
            <p className="text-xs text-cream-300/70">z. B. vor dem Start oder über Nacht</p>
          </div>
          <button
            role="switch"
            aria-checked={!s.paused}
            onClick={() => run(() => api.adminUpdateSettings(token, { paused: !s.paused }),
              s.paused ? 'Ziehen wieder erlaubt ▶️' : 'Ziehen pausiert ⏸️')}
            className={`relative h-8 w-14 rounded-full transition-colors ${s.paused ? 'bg-ink-600' : 'bg-ok-500'}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-cream-100 transition-all ${s.paused ? 'left-1' : 'left-7'}`} />
          </button>
        </div>

        <div>
          <p className="font-semibold text-cream-100">Ansage an alle</p>
          <p className="mb-2 text-xs text-cream-300/70">erscheint oben auf der Startseite (leer = keine)</p>
          <textarea className="field min-h-20 resize-none text-base" maxLength={200} value={announcement}
            placeholder="z. B. 20 Uhr Treffpunkt Martinskeller 🍷" onChange={(e) => setAnnouncement(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="btn btn-gold flex-1 text-sm" disabled={announcement.trim() === s.announcement}
              onClick={() => run(() => api.adminUpdateSettings(token, { announcement }), 'Ansage gespeichert 📣')}>
              Speichern
            </button>
            {s.announcement && (
              <button className="btn btn-ghost text-sm"
                onClick={() => { setAnnouncement(''); void run(() => api.adminUpdateSettings(token, { announcement: '' }), 'Ansage entfernt') }}>
                Entfernen
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Spieler */}
      <section className="adm-section card-surface mt-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-cream-100">Spieler & PINs</h2>
          <button onClick={() => setShowPins((v) => !v)} className="rounded-full bg-ink-700 px-3 py-1.5 text-xs font-semibold">
            {showPins ? '🙈 verbergen' : '👁 PINs zeigen'}
          </button>
        </div>
        <p className="mt-1 text-xs text-cream-300/60">Spieler antippen für Extra-Karten, PIN, Limit, Entfernen.</p>
        <ul className="mt-2 divide-y divide-ink-700">
          {data.players.map((p) => (
            <li key={p.id}>
              <button className="flex w-full items-center gap-3 py-2.5 text-left" onClick={() => setPlayerId(p.id)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-cream-100">
                    {p.name} {p.isAdmin && <span className="text-xs text-gold-300">Admin</span>}
                    {p.draws.extraLeft > 0 && <span className="ml-1 text-xs text-gold-300">🎁 {p.draws.extraLeft}</span>}
                  </p>
                  <p className="text-xs text-cream-300/70">
                    heute {p.draws.regularLeft} + {p.draws.bonusLeft} Ersatz + {p.draws.extraLeft} Extra
                  </p>
                </div>
                <code className="w-14 rounded-lg bg-ink-950 py-1 text-center font-mono text-lg font-bold tracking-widest text-gold-300">
                  {showPins ? p.pin : '••••'}
                </code>
                <span className="text-cream-300/50">›</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          className="btn btn-wine mt-3 w-full text-sm"
          onClick={() => setConfirm({
            text: `Tageslimit für ALLE zurücksetzen? Jeder bekommt heute wieder ${s.drawsPerDay} reguläre Ziehung${s.drawsPerDay === 1 ? '' : 'en'}.`,
            action: () => api.adminResetDraws(token, null),
            ok: 'Tageslimit für alle zurückgesetzt',
          })}
        >
          🔄 Tageslimit für alle zurücksetzen
        </button>
        <form onSubmit={addPlayer} className="mt-4 flex gap-2">
          <input className="field" placeholder="Neuer Spieler" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} />
          <button className="btn btn-gold shrink-0" disabled={!newName.trim()}>+ Anlegen</button>
        </form>
      </section>

      {/* ------------------------------------------------ Stapel */}
      <section className="adm-section card-surface mt-4 p-4">
        <h2 className="font-display text-xl font-semibold text-cream-100">Unberührte Karten im Stapel</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {([1, 2, 3] as const).map((l) => (
            <div key={l} className="rounded-2xl bg-ink-950/60 p-3">
              <p className="font-display text-2xl font-extrabold text-gold-300">{data.poolLeft[l] ?? 0}</p>
              <p className="text-xs text-cream-300/70">{LEVELS[l].label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ Missionen */}
      <section className="adm-section card-surface mt-4 p-4">
        <h2 className="font-display text-xl font-semibold text-cream-100">Alle Missionen</h2>
        <div className="mt-3 flex gap-1.5 overflow-x-auto text-xs font-semibold">
          {([
            ['open', `Laufend (${counts.open})`],
            ['confirmed', `Erledigt (${counts.confirmed})`],
            ['failed', `Gescheitert (${counts.failed})`],
            ['all', 'Alle'],
          ] as [Filter, string][]).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-3 py-2 ${filter === f ? 'bg-gold-400 text-wine-950' : 'bg-ink-700 text-cream-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {assignments.length === 0 && <p className="mt-4 text-center text-sm text-cream-300/60">Nichts in dieser Ansicht.</p>}
        <ul className="mt-3 space-y-2">
          {assignments.map((a) => (
            <li key={a.id} className="rounded-2xl bg-ink-950/60 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-cream-100">{a.playerName}: <span className="font-normal">{a.title}</span></p>
                <span className="shrink-0 font-display font-bold text-gold-300">{a.level} P</span>
              </div>
              <p className="mt-1 text-xs text-cream-300/70">
                {STATUS_LABEL[a.status]}
                {a.status === 'pending' && ` auf ${a.witnessName ?? '?'}`}
                {a.status === 'confirmed' && a.witnessName && ` · Zeuge: ${a.witnessName}`}
                {a.status === 'failed' && (a.failReason === 'rejected' ? ` · abgelehnt${a.witnessName ? ` von ${a.witnessName}` : ''}` : ' · aufgegeben')}
                {a.kind === 'replacement' && ' · Ersatz-Karte'}
                {a.isExtra && ' · Extra-Karte'}
                {' · '}{new Date(a.drawnAt).toLocaleString('de-AT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
              {(a.status === 'active' || a.status === 'pending') && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                  {a.status === 'pending' && (
                    <>
                      <button className="rounded-lg bg-ok-500/80 px-2.5 py-1.5 text-white"
                        onClick={() => setConfirm({
                          text: `„${a.title}“ von ${a.playerName} anstelle von ${a.witnessName ?? 'dem Zeugen'} bestätigen? ${a.playerName} bekommt ${a.level} Punkt${a.level > 1 ? 'e' : ''}.`,
                          action: () => api.adminResolve(token, a.id, true), ok: 'Als Admin bestätigt ✅',
                        })}>✓ bestätigen</button>
                      <button className="rounded-lg bg-wine-600 px-2.5 py-1.5"
                        onClick={() => setConfirm({
                          text: `„${a.title}“ von ${a.playerName} ablehnen? Zählt als gescheitert (0 Punkte).`,
                          action: () => api.adminResolve(token, a.id, false), ok: 'Als Admin abgelehnt',
                        })}>✕ ablehnen</button>
                    </>
                  )}
                  <button className="rounded-lg bg-ink-700 px-2.5 py-1.5"
                    onClick={() => setConfirm({
                      text: `„${a.title}“ zurück in den Stapel legen? Die Karte verschwindet bei ${a.playerName}, die Ziehung wird erstattet (sofern von heute bzw. Extra-Karte).`,
                      action: () => api.adminReturnCard(token, a.id), ok: 'Karte zurück im Stapel ↩️',
                    })}>↩ zurück in Stapel</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------ Gefahrenzone */}
      <section className="adm-section mt-4 rounded-[1.25rem] border border-red-500/40 bg-red-950/20 p-4">
        <h2 className="font-display text-xl font-semibold text-red-300">Gefahrenzone</h2>
        <p className="mt-1 text-sm text-cream-300/80">
          Neues Spiel: alle Karten zurück in den Stapel und neu gemischt, alle Punkte auf 0, Extra-Karten weg.
          Spieler und PINs bleiben.
        </p>
        <button className="btn mt-3 w-full bg-red-700 text-white" onClick={() => { setResetWord(''); setResetOpen(true) }}>
          🔁 Spiel komplett zurücksetzen
        </button>
      </section>

      {/* ------------------------------------------------ Spieler-Modal */}
      {selected && (
        <Modal title={selected.name} onClose={() => setPlayerId(null)}>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-cream-300/80">
            <div className="rounded-2xl bg-ink-800 p-2"><p className="font-display text-xl font-bold text-gold-300">{selected.draws.regularLeft}</p>regulär</div>
            <div className="rounded-2xl bg-ink-800 p-2"><p className="font-display text-xl font-bold text-gold-300">{selected.draws.bonusLeft}</p>Ersatz</div>
            <div className="rounded-2xl bg-ink-800 p-2"><p className="font-display text-xl font-bold text-gold-300">{selected.draws.extraLeft}</p>Extra</div>
          </div>

          <p className="mt-5 mb-2 font-semibold text-cream-100">🎁 Extra-Karte geben</p>
          <p className="mb-2 text-xs text-cream-300/70">Zusätzliche Ziehung(en), verfallen nicht. Freie Wahl der Stufe.</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n} className="btn btn-gold px-0"
                onClick={() => run(() => api.adminGiveExtra(token, selected.id, n), `${selected.name}: +${n} Extra-Karte${n > 1 ? 'n' : ''} 🎁`)}>
                +{n}
              </button>
            ))}
            <button className="btn btn-ghost px-0" disabled={selected.draws.extraLeft === 0}
              onClick={() => run(() => api.adminGiveExtra(token, selected.id, -1), `${selected.name}: −1 Extra-Karte`)}>
              −1
            </button>
          </div>

          <div className="mt-5 grid gap-2.5">
            <button className="btn btn-ghost w-full"
              onClick={() => setConfirm({
                text: `Tageslimit von ${selected.name} zurücksetzen? ${selected.name} bekommt heute wieder ${s.drawsPerDay} reguläre Ziehung${s.drawsPerDay === 1 ? '' : 'en'}.`,
                action: () => api.adminResetDraws(token, selected.id), ok: `Tageslimit von ${selected.name} zurückgesetzt`,
              })}>🔄 Tageslimit zurücksetzen</button>
            {selected.isAdmin ? (
              <p className="rounded-2xl bg-ink-800 p-3 text-center text-xs text-cream-300/70">🔒 Admin-PIN ist fest hinterlegt.</p>
            ) : (
              <>
                <button className="btn btn-ghost w-full"
                  onClick={() => setConfirm({
                    text: `Neuen PIN für ${selected.name} erzeugen? Der alte PIN funktioniert dann nicht mehr und ${selected.name} wird abgemeldet.`,
                    action: async () => { await api.adminResetPin(token, selected.id); setShowPins(true) },
                    ok: `Neuer PIN für ${selected.name} erzeugt`,
                  })}>🔑 Neuen PIN erzeugen</button>
                <button className="btn w-full bg-red-800/80 text-cream-100"
                  onClick={() => setConfirm({
                    danger: true,
                    text: `${selected.name} wirklich entfernen? Alle Karten und Punkte von ${selected.name} werden gelöscht. Wartet jemand auf ${selected.name} als Zeugen, kann er einen neuen wählen.`,
                    action: async () => { await api.adminDeletePlayer(token, selected.id); setPlayerId(null) },
                    ok: `${selected.name} entfernt`,
                  })}>🗑 Spieler entfernen</button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------ Reset-Modal */}
      {resetOpen && (
        <Modal title="Spiel zurücksetzen?" onClose={() => setResetOpen(false)}>
          <p className="text-sm text-cream-300">
            Das löscht <strong className="text-cream-100">alle gezogenen Karten und alle Punkte</strong> unwiderruflich.
            Alle 90 Karten liegen danach wieder im Stapel. Spieler, PINs und Einstellungen bleiben.
          </p>
          <label className="mt-4 block text-sm text-cream-300">
            Zum Bestätigen <strong className="text-red-300">{RESET_WORD}</strong> eintippen:
            <input className="field mt-2 text-center font-mono text-xl tracking-widest uppercase" value={resetWord}
              autoCapitalize="characters" onChange={(e) => setResetWord(e.target.value)} />
          </label>
          <button
            className="btn mt-4 w-full bg-red-700 text-white"
            disabled={resetWord.trim().toUpperCase() !== RESET_WORD}
            onClick={() => {
              setResetOpen(false)
              void run(() => api.adminResetGame(token), 'Neues Spiel gestartet – alles gemischt! 🃏')
            }}
          >
            Endgültig zurücksetzen
          </button>
        </Modal>
      )}

      {/* ------------------------------------------------ Bestätigungs-Modal */}
      {confirm && (
        <Modal title={confirm.title ?? 'Sicher?'} onClose={() => setConfirm(null)}>
          <p className="text-sm text-cream-300">{confirm.text}</p>
          <div className="mt-5 grid gap-2.5">
            <button
              className={`btn w-full ${confirm.danger ? 'bg-red-700 text-white' : 'btn-gold'}`}
              onClick={() => {
                const c = confirm
                setConfirm(null)
                void run(c.action, c.ok)
              }}
            >
              Ja, ausführen
            </button>
            <button className="btn btn-ghost w-full" onClick={() => setConfirm(null)}>Abbrechen</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
