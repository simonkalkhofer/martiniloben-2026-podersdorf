import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useToast } from '../components/Toast'
import { api, errorText, LEVELS } from '../lib/api'
import type { PageProps } from '../App'

export default function Confirmations({ token, state, refresh }: PageProps) {
  const toast = useToast()
  const root = useRef<HTMLDivElement>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const list = state.confirmations

  useGSAP(() => {
    gsap.from('.conf-item', { y: 20, autoAlpha: 0, stagger: 0.08 })
  }, { scope: root, dependencies: [list.length], revertOnUpdate: true })

  const { contextSafe } = useGSAP({ scope: root })

  const decide = contextSafe(async (id: number, approve: boolean, playerName: string) => {
    setBusyId(id)
    try {
      await api.resolve(token, id, approve)
      // Karte fliegt raus, dann neu laden
      await gsap.to(`[data-conf="${id}"]`, {
        x: approve ? 320 : -320, rotation: approve ? 6 : -6, autoAlpha: 0, duration: 0.4, ease: 'power2.in',
      })
      await refresh()
      toast(approve ? `Punkte für ${playerName} gutgeschrieben 🍷` : `Mission von ${playerName} abgelehnt`)
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusyId(null)
    }
  })

  return (
    <div ref={root} className="px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="font-display text-3xl font-extrabold text-cream-100">Bestätigungen</h1>
      <p className="mt-1 text-sm text-cream-300/80">Hier landen Missionen, bei denen du als Zeuge ausgewählt wurdest.</p>

      {list.length === 0 && (
        <div className="card-surface mt-6 p-8 text-center">
          <p className="text-4xl">🕵️</p>
          <p className="mt-2 text-sm text-cream-300/80">Gerade wartet niemand auf dich. Augen offen halten!</p>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {list.map((c) => (
          <article key={c.id} data-conf={c.id} className="conf-item card-surface p-5">
            <p className="text-[15px] leading-relaxed text-cream-200">
              <strong className="text-gold-300">{c.playerName}</strong> behauptet, die Mission{' '}
              <strong className="text-cream-100">„{c.title}“</strong> ({c.level} Punkt{c.level > 1 ? 'e' : ''}) erledigt zu haben.
            </p>
            <p className="mt-3 rounded-2xl bg-ink-950/60 p-3 text-sm leading-relaxed text-cream-300/85">
              <span className="mb-1 block text-[11px] font-semibold tracking-wider text-gold-300/80 uppercase">
                Aufgabe · {LEVELS[c.level].label}
              </span>
              {c.description}
            </p>
            <div className="mt-5 grid gap-2.5">
              <button disabled={busyId !== null} onClick={() => decide(c.id, true, c.playerName)} className="btn w-full bg-ok-500 text-lg text-white">
                ✓ Bestätigen (Punkte gutschreiben)
              </button>
              <button disabled={busyId !== null} onClick={() => decide(c.id, false, c.playerName)} className="btn btn-wine w-full text-lg">
                ✕ Ablehnen
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
