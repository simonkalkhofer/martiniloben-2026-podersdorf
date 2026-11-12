import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Hero from '../components/Hero'
import type { PageProps } from '../App'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Home({ state, onLogout, onAdmin }: PageProps & { onLogout: () => void; onAdmin: () => void }) {
  const listRef = useRef<HTMLOListElement>(null)
  const board = state.leaderboard
  const signature = board.map((r) => `${r.id}:${r.points}`).join('|')

  // Rangliste neu einblenden, wenn sich Punkte/Reihenfolge ändern
  useGSAP(() => {
    gsap.from('.lb-row', { x: -24, autoAlpha: 0, stagger: 0.05, duration: 0.45 })
  }, { scope: listRef, dependencies: [signature], revertOnUpdate: true })

  // Ränge mit Gleichstand teilen sich den Platz
  let lastPoints = -1
  let lastRank = 0
  const ranked = board.map((r, i) => {
    const rank = r.points === lastPoints ? lastRank : i + 1
    lastPoints = r.points
    lastRank = rank
    return { ...r, rank }
  })

  return (
    <div>
      <Hero>
        <p className="mt-1 text-sm text-cream-200/85">Servus, <strong className="text-gold-300">{state.me.name}</strong>!</p>
      </Hero>

      <div className="flex gap-2 px-5 pt-4">
        {state.me.isAdmin && (
          <button onClick={onAdmin} className="btn btn-wine flex-1 text-sm">⚙️ Admin-Bereich</button>
        )}
        <button onClick={onLogout} className="btn btn-ghost flex-1 text-sm">Abmelden</button>
      </div>

      <section className="px-5 pt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold text-cream-100">Live-Rangliste</h2>
          <span className="flex items-center gap-1.5 text-xs text-cream-300/70">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ok-500" /> live
          </span>
        </div>

        <ol ref={listRef} className="space-y-2.5">
          {ranked.map((r) => {
            const isMe = r.id === state.me.id
            return (
              <li
                key={r.id}
                className={`lb-row card-surface flex items-center gap-3 p-3.5 ${isMe ? 'ring-2 ring-gold-400/70' : ''}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-wine-800 font-display text-lg font-bold text-gold-300">
                  {r.points > 0 && r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-cream-100">
                    {r.name} {isMe && <span className="text-xs font-normal text-gold-300">(du)</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs text-cream-300/75">
                    <span>{r.done} erledigt</span>
                    <span title="Leicht">🟢 {r.done1}</span>
                    <span title="Mittel">🟡 {r.done2}</span>
                    <span title="Schwer">🔴 {r.done3}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl leading-none font-extrabold text-gold-300">{r.points}</p>
                  <p className="text-[10px] tracking-wider text-cream-300/60 uppercase">Punkte</p>
                </div>
              </li>
            )
          })}
        </ol>

        <p className="mt-4 text-center text-xs text-cream-300/50">🟢 Leicht · 🟡 Mittel · 🔴 Schwer</p>
      </section>
    </div>
  )
}
