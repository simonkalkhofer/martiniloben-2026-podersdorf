import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { api, errorText, LEVELS } from '../lib/api'
import type { Level } from '../lib/missions'
import type { Card } from '../lib/types'
import type { PageProps } from '../App'

const LEVEL_STYLE: Record<Level, string> = {
  1: 'from-emerald-700/80 to-emerald-900/80 border-emerald-400/30',
  2: 'from-gold-500/80 to-amber-800/80 border-gold-300/40',
  3: 'from-wine-500 to-wine-800 border-wine-500/60',
}

export default function Missions({ token, state, refresh }: PageProps) {
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [reportCard, setReportCard] = useState<Card | null>(null)
  const [giveUpCard, setGiveUpCard] = useState<Card | null>(null)
  const [newCardId, setNewCardId] = useState<number | null>(null)

  const { regularLeft, bonusLeft, extraLeft } = state.draws
  const paused = state.settings.paused
  const canDraw = !paused && regularLeft + bonusLeft + extraLeft > 0
  const active = state.myCards.filter((c) => c.status === 'active' || c.status === 'pending')
  const history = state.myCards.filter((c) => c.status === 'confirmed' || c.status === 'failed')

  // Neu gezogene Karte: "aufdecken"-Animation
  useGSAP(() => {
    if (newCardId == null) return
    gsap.timeline()
      .fromTo(`[data-card="${newCardId}"]`,
        { rotationY: 90, scale: 0.8, autoAlpha: 0, transformPerspective: 800 },
        { rotationY: 0, scale: 1, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.4)' })
      .fromTo(`[data-card="${newCardId}"] .card-shine`,
        { xPercent: -120 }, { xPercent: 120, duration: 0.8, ease: 'power2.inOut' }, '-=0.3')
  }, { scope: root, dependencies: [newCardId] })

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true)
    try {
      await fn()
      await refresh()
      if (okMsg) toast(okMsg)
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function draw(level: Level) {
    const before = new Set(state.myCards.map((c) => c.id))
    setBusy(true)
    try {
      await api.drawCard(token, level)
      const fresh = await api.getState(token)
      const added = fresh.myCards.find((c) => !before.has(c.id))
      await refresh()
      if (added) setNewCardId(added.id)
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const others = state.leaderboard.filter((p) => p.id !== state.me.id).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div ref={root} className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="font-display text-3xl font-extrabold text-cream-100">Meine Missionen</h1>

      <div className="card-surface mt-4 p-4">
        <p className="text-sm text-cream-200">
          Heute noch <strong className="text-xl text-gold-300">{regularLeft}</strong> reguläre Ziehung{regularLeft === 1 ? '' : 'en'}
          {' '}<span className="text-cream-300/80">(+ <strong className="text-gold-300">{bonusLeft}</strong> Ersatz-Ziehung{bonusLeft === 1 ? '' : 'en'})</span> verfügbar
        </p>
        {extraLeft > 0 && (
          <p className="mt-2 rounded-xl bg-gold-400/15 px-3 py-2 text-sm text-gold-300">
            🎁 Du hast {extraLeft} Extra-Karte{extraLeft === 1 ? '' : 'n'} vom Admin bekommen!
          </p>
        )}
        {paused ? (
          <p className="mt-2 rounded-xl bg-ink-700 px-3 py-2 text-sm text-cream-200">⏸️ Das Ziehen ist gerade pausiert.</p>
        ) : regularLeft === 0 && bonusLeft > 0 ? (
          <p className="mt-1 text-xs text-cream-300/70">Die nächste Karte ist eine Ersatz-Karte.</p>
        ) : regularLeft === 0 && bonusLeft === 0 && extraLeft > 0 ? (
          <p className="mt-1 text-xs text-cream-300/70">Die nächste Karte ist eine Extra-Karte.</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {([1, 2, 3] as Level[]).map((l) => (
            <button
              key={l}
              disabled={!canDraw || busy}
              onClick={() => draw(l)}
              className={`btn min-h-24 flex-col border bg-gradient-to-b text-cream-100 ${LEVEL_STYLE[l]}`}
            >
              <span className="font-display text-lg">{LEVELS[l].label}</span>
              <span className="text-xs opacity-85">{l} Punkt{l > 1 ? 'e' : ''}</span>
            </button>
          ))}
        </div>
        {!canDraw && !paused && <p className="mt-3 text-center text-xs text-cream-300/70">Für heute ist der Stapel leer – morgen geht’s weiter! 🍷</p>}
      </div>

      <h2 className="mt-7 mb-3 font-display text-xl font-semibold text-cream-100">Aktive Karten ({active.length})</h2>
      {active.length === 0 && (
        <p className="card-surface p-5 text-center text-sm text-cream-300/70">Noch keine aktive Karte. Zieh eine!</p>
      )}
      <div className="space-y-4">
        {active.map((c) => (
          <article key={c.id} data-card={c.id} className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br p-5 shadow-xl ${LEVEL_STYLE[c.level]}`}>
            <span className="card-shine pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-white/15" style={{ transform: 'translateX(-200%)' }} />
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="rounded-full bg-black/25 px-2.5 py-1">{LEVELS[c.level].label} · {c.level} Pkt.</span>
              <span className={`rounded-full px-2.5 py-1 ${c.kind === 'replacement' || c.isExtra ? 'bg-cream-100 text-wine-900' : 'bg-black/25'}`}>
                {c.kind === 'replacement' ? 'Ersatz-Karte' : c.isExtra ? '🎁 Extra-Karte' : 'Reguläre Karte'}
              </span>
            </div>
            <h3 className="mt-3 font-display text-2xl leading-tight font-extrabold text-cream-100">{c.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-cream-100/90">{c.description}</p>

            {c.status === 'pending' ? (
              <p className="mt-4 rounded-2xl bg-black/30 px-4 py-3 text-center text-sm font-semibold text-gold-300">
                ⏳ Wartet auf Bestätigung von {c.witnessName}
              </p>
            ) : (
              <div className="mt-5 grid gap-2.5">
                <button disabled={busy} onClick={() => setReportCard(c)} className="btn w-full bg-cream-100 text-wine-900 shadow-lg">✓ Als erledigt melden</button>
                <button disabled={busy} onClick={() => setGiveUpCard(c)} className="btn w-full bg-black/30 text-cream-100">Nicht geschafft / Aufgeben</button>
              </div>
            )}
          </article>
        ))}
      </div>

      {history.length > 0 && (
        <details className="mt-8 mb-4">
          <summary className="cursor-pointer font-display text-lg font-semibold text-cream-200">Erledigt & gescheitert ({history.length})</summary>
          <ul className="mt-3 space-y-2">
            {history.map((c) => (
              <li key={c.id} className="card-surface flex items-center gap-3 p-3 text-sm">
                <span className="text-lg">{c.status === 'confirmed' ? '✅' : '❌'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-cream-100">{c.title}</span>
                  <span className="text-xs text-cream-300/70">
                    {c.status === 'confirmed'
                      ? `bestätigt von ${c.witnessName}`
                      : c.failReason === 'rejected' ? `abgelehnt von ${c.witnessName}` : 'aufgegeben'}
                    {c.kind === 'replacement' && ' · Ersatz-Karte'}
                    {c.isExtra && ' · Extra-Karte'}
                  </span>
                </span>
                <span className="font-display font-bold text-gold-300">{c.status === 'confirmed' ? `+${c.level}` : '0'}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {reportCard && (
        <Modal title="Wer war Zeuge?" onClose={() => setReportCard(null)}>
          <p className="mb-4 text-sm text-cream-300">
            Wähle, wer bestätigen soll, dass du <strong className="text-cream-100">„{reportCard.title}“</strong> geschafft hast.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {others.map((p) => (
              <button
                key={p.id}
                disabled={busy}
                className="btn btn-ghost"
                onClick={() => {
                  const card = reportCard
                  setReportCard(null)
                  void run(() => api.reportDone(token, card.id, p.id), `Anfrage an ${p.name} geschickt 🤫`)
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {giveUpCard && (
        <Modal title="Wirklich aufgeben?" onClose={() => setGiveUpCard(null)}>
          <p className="text-sm text-cream-300">
            „{giveUpCard.title}“ wird als <strong className="text-cream-100">gescheitert (0 Punkte)</strong> gewertet.{' '}
            {giveUpCard.kind === 'regular'
              ? 'Dafür bekommst du sofort +1 Ersatz-Ziehung.'
              : 'Das ist bereits eine Ersatz-Karte – es gibt keine weitere Ersatz-Ziehung.'}
          </p>
          <div className="mt-5 grid gap-2.5">
            <button
              className="btn btn-wine w-full"
              disabled={busy}
              onClick={() => {
                const card = giveUpCard
                setGiveUpCard(null)
                void run(() => api.giveUp(token, card.id), card.kind === 'regular' ? '+1 Ersatz-Ziehung freigeschaltet' : 'Karte abgelegt')
              }}
            >
              Ja, aufgeben
            </button>
            <button className="btn btn-ghost w-full" onClick={() => setGiveUpCard(null)}>Doch weiterversuchen</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
