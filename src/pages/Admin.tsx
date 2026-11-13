import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { api, errorText, LEVELS } from '../lib/api'
import type { AdminOverview, CardStatus } from '../lib/types'
import type { PageProps } from '../App'

const STATUS_LABEL: Record<CardStatus, string> = {
  active: '🃏 läuft',
  pending: '⏳ wartet',
  confirmed: '✅ erledigt',
  failed: '❌ gescheitert',
}

type Filter = 'all' | 'open' | 'confirmed' | 'failed'

export default function Admin({ token, state, onBack }: PageProps & { onBack: () => void }) {
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<AdminOverview | null>(null)
  const [showPins, setShowPins] = useState(false)
  const [newName, setNewName] = useState('')
  const [filter, setFilter] = useState<Filter>('open')
  const [confirm, setConfirm] = useState<{ text: string; action: () => Promise<unknown>; ok: string } | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await api.adminOverview(token))
    } catch (e) {
      toast(errorText(e))
    }
  }, [token, toast])

  // bei jeder Spieländerung (state kommt live rein) neu laden
  useEffect(() => { void load() }, [load, state])

  useGSAP(() => {
    if (data) gsap.from('.adm-section', { y: 16, autoAlpha: 0, stagger: 0.07 })
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

  const assignments = (data?.assignments ?? []).filter((a) =>
    filter === 'all' ? true
      : filter === 'open' ? a.status === 'active' || a.status === 'pending'
      : a.status === filter)

  const counts = {
    open: data?.assignments.filter((a) => a.status === 'active' || a.status === 'pending').length ?? 0,
    confirmed: data?.assignments.filter((a) => a.status === 'confirmed').length ?? 0,
    failed: data?.assignments.filter((a) => a.status === 'failed').length ?? 0,
  }

  return (
    <div ref={root} className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-6">
      <button onClick={onBack} className="text-sm font-semibold text-gold-300">← Zurück</button>
      <h1 className="mt-2 font-display text-3xl font-extrabold text-cream-100">Admin-Bereich</h1>
      <p className="mt-1 text-sm text-cream-300/80">Nur für dich sichtbar, {state.me.name}.</p>

      {!data && <p className="mt-6 animate-pulse text-cream-300">Lade …</p>}

      {data && (
        <>
          {/* PIN-Übersicht */}
          <section className="adm-section card-surface mt-5 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-cream-100">Spieler & PINs</h2>
              <button onClick={() => setShowPins((s) => !s)} className="rounded-full bg-ink-700 px-3 py-1.5 text-xs font-semibold">
                {showPins ? '🙈 verbergen' : '👁 PINs zeigen'}
              </button>
            </div>
            <ul className="mt-3 divide-y divide-ink-700">
              {data.players.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-cream-100">
                      {p.name} {p.isAdmin && <span className="text-xs text-gold-300">Admin</span>}
                    </p>
                    <p className="text-xs text-cream-300/70">
                      heute {p.draws.regularLeft} + {p.draws.bonusLeft} Ziehungen
                    </p>
                  </div>
                  <code className="w-14 rounded-lg bg-ink-950 py-1 text-center font-mono text-lg font-bold tracking-widest text-gold-300">
                    {showPins ? p.pin : '••••'}
                  </code>
                  {p.isAdmin ? (
                    // Admin-PIN ist fest im Server hinterlegt
                    <span title="Fester PIN" className="grid h-10 w-10 place-items-center rounded-xl bg-ink-800 opacity-50">🔒</span>
                  ) : (
                    <button
                      title="PIN neu erzeugen"
                      className="grid h-10 w-10 place-items-center rounded-xl bg-ink-700"
                      onClick={() => setConfirm({
                        text: `Neuen PIN für ${p.name} erzeugen? Der alte PIN funktioniert dann nicht mehr und ${p.name} wird abgemeldet.`,
                        action: () => api.adminResetPin(token, p.id),
                        ok: `Neuer PIN für ${p.name} erzeugt`,
                      })}
                    >🔑</button>
                  )}
                  <button
                    title="Tageslimit zurücksetzen"
                    className="grid h-10 w-10 place-items-center rounded-xl bg-ink-700"
                    onClick={() => setConfirm({
                      text: `Tageslimit von ${p.name} zurücksetzen? ${p.name} bekommt heute wieder 2 reguläre Ziehungen.`,
                      action: () => api.adminResetDraws(token, p.id),
                      ok: `Tageslimit von ${p.name} zurückgesetzt`,
                    })}
                  >🔄</button>
                </li>
              ))}
            </ul>
            <button
              className="btn btn-wine mt-3 w-full text-sm"
              onClick={() => setConfirm({
                text: 'Tageslimit für ALLE Spieler zurücksetzen? Jeder bekommt heute wieder 2 reguläre Ziehungen.',
                action: () => api.adminResetDraws(token, null),
                ok: 'Tageslimit für alle zurückgesetzt',
              })}
            >
              🔄 Tageslimit für alle zurücksetzen
            </button>
          </section>

          {/* Spieler hinzufügen */}
          <section className="adm-section card-surface mt-4 p-4">
            <h2 className="font-display text-xl font-semibold text-cream-100">Spieler hinzufügen</h2>
            <form onSubmit={addPlayer} className="mt-3 flex gap-2">
              <input className="field" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={24} />
              <button className="btn btn-gold shrink-0" disabled={!newName.trim()}>+ Anlegen</button>
            </form>
            <p className="mt-2 text-xs text-cream-300/60">Der PIN wird zufällig erzeugt und oben angezeigt.</p>
          </section>

          {/* Kartenstapel */}
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

          {/* Missionsübersicht */}
          <section className="adm-section card-surface mt-4 p-4">
            <h2 className="font-display text-xl font-semibold text-cream-100">Alle Missionen</h2>
            <div className="mt-3 flex gap-1.5 overflow-x-auto text-xs font-semibold">
              {([
                ['open', `Laufend (${counts.open})`],
                ['confirmed', `Erledigt (${counts.confirmed})`],
                ['failed', `Gescheitert (${counts.failed})`],
                ['all', 'Alle'],
              ] as [Filter, string][]).map(([f, label]) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 rounded-full px-3 py-2 ${filter === f ? 'bg-gold-400 text-wine-950' : 'bg-ink-700 text-cream-200'}`}
                >
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
                    {a.status === 'pending' && ` auf ${a.witnessName}`}
                    {a.status === 'confirmed' && ` · Zeuge: ${a.witnessName}`}
                    {a.status === 'failed' && (a.failReason === 'rejected' ? ` · abgelehnt von ${a.witnessName}` : ' · aufgegeben')}
                    {a.kind === 'replacement' && ' · Ersatz-Karte'}
                    {' · '}{new Date(a.drawnAt).toLocaleString('de-AT', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {confirm && (
        <Modal title="Sicher?" onClose={() => setConfirm(null)}>
          <p className="text-sm text-cream-300">{confirm.text}</p>
          <div className="mt-5 grid gap-2.5">
            <button
              className="btn btn-gold w-full"
              onClick={() => {
                const c = confirm
                setConfirm(null)
                if (c.text.startsWith('Neuen PIN')) setShowPins(true)
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
