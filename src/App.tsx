import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { api, errorText } from './lib/api'
import type { GameState, Session } from './lib/types'
import Login from './pages/Login'
import Home from './pages/Home'
import Missions from './pages/Missions'
import Confirmations from './pages/Confirmations'
import Admin from './pages/Admin'
import BottomNav, { type Tab } from './components/BottomNav'
import { ToastProvider, useToast } from './components/Toast'

const SESSION_KEY = 'martiniloben-session'

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  )
}

function Shell() {
  const [session, setSession] = useState<Session | null>(readSession)
  const [state, setState] = useState<GameState | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const toast = useToast()

  const logout = useCallback(() => {
    if (session) void api.logout(session.token).catch(() => {})
    localStorage.removeItem(SESSION_KEY)
    setSession(null)
    setState(null)
    setTab('home')
  }, [session])

  const refresh = useCallback(async () => {
    if (!session) return
    try {
      setState(await api.getState(session.token))
    } catch (e) {
      const msg = errorText(e)
      if (msg.includes('Nicht angemeldet')) {
        localStorage.removeItem(SESSION_KEY)
        setSession(null)
        toast('Bitte neu anmelden.')
      } else {
        toast(msg)
      }
    }
  }, [session, toast])

  useEffect(() => {
    if (!session) return
    void refresh()
    return api.subscribe(() => void refresh())
  }, [session, refresh])

  const onLogin = (s: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setSession(s)
  }

  if (!session) return <Login onLogin={onLogin} />
  if (!state) {
    return (
      <div className="grid min-h-dvh place-items-center text-cream-300">
        <span className="animate-pulse font-display text-xl">Keller wird aufgesperrt …</span>
      </div>
    )
  }

  const ctx = { token: session.token, state, refresh }

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <TabView key={tab}>
        {tab === 'home' && <Home {...ctx} onLogout={logout} onAdmin={() => setTab('admin')} />}
        {tab === 'missions' && <Missions {...ctx} />}
        {tab === 'confirm' && <Confirmations {...ctx} />}
        {tab === 'admin' && state.me.isAdmin && <Admin {...ctx} onBack={() => setTab('home')} />}
      </TabView>
      <BottomNav tab={tab} onChange={setTab} badge={state.confirmations.length} />
    </div>
  )
}

/** Sanfter Seitenwechsel zwischen Tabs (GSAP). */
function TabView({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    // clearProps: kein bleibendes transform → sonst würden fixed-Elemente (Modals) im Tab "gefangen"
    gsap.from(ref.current, { autoAlpha: 0, y: 14, duration: 0.35, clearProps: 'transform,opacity,visibility' })
    window.scrollTo({ top: 0 })
  }, { scope: ref })
  return <div ref={ref}>{children}</div>
}

export interface PageProps {
  token: string
  state: GameState
  refresh: () => Promise<void>
}
