import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Hero from '../components/Hero'
import { api, errorText } from '../lib/api'
import { demoAdminPin } from '../lib/demoApi'
import type { PlayerPublic, Session } from '../lib/types'

export default function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [players, setPlayers] = useState<PlayerPublic[]>([])
  const [playerId, setPlayerId] = useState<number | ''>('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    api.listPlayers().then(setPlayers).catch((e) => setError(errorText(e)))
  }, [])

  const { contextSafe } = useGSAP(() => {
    gsap.from('.login-item', { y: 24, autoAlpha: 0, stagger: 0.08, delay: 0.6 })
  }, { scope: formRef })

  const shake = contextSafe(() => {
    gsap.fromTo(formRef.current, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
  })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (playerId === '' || pin.length !== 4) return
    setBusy(true)
    setError('')
    try {
      onLogin(await api.login(playerId, pin))
    } catch (err) {
      setError(errorText(err))
      setPin('')
      shake()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <Hero>
        <p className="mt-2 max-w-[16rem] text-sm text-cream-200/85">
          Das geheime Begleitspiel zum Weinfest. Nicht verraten, wer was vorhat!
        </p>
      </Hero>

      <form ref={formRef} onSubmit={submit} className="-mt-6 space-y-4 px-5 pb-10">
        <div className="login-item card-surface relative space-y-4 p-5 shadow-2xl">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-cream-300">Wer bist du?</span>
            <select
              className="field appearance-none"
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Spieler auswählen …</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-cream-300">Dein 4-stelliger PIN</span>
            <input
              className="field text-center font-mono text-2xl tracking-[0.6em]"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{4}"
              maxLength={4}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </label>

          {error && <p className="rounded-xl bg-wine-700/50 px-3 py-2 text-sm text-cream-100" role="alert">{error}</p>}

          <button className="btn btn-gold w-full text-lg" disabled={busy || playerId === '' || pin.length !== 4}>
            {busy ? 'Moment …' : 'Prost & los geht’s'}
          </button>
        </div>

        {api.mode === 'demo' && (
          <p className="login-item rounded-2xl border border-dashed border-gold-400/30 p-4 text-xs leading-relaxed text-cream-300/80">
            <strong className="text-gold-300">Demo-Modus</strong> – keine Supabase-Verbindung konfiguriert, alle Daten
            liegen nur in diesem Browser. Admin-PIN für <em>Simon</em>:{' '}
            <code className="font-mono text-gold-300">{demoAdminPin()}</code>
          </p>
        )}
      </form>
    </div>
  )
}
