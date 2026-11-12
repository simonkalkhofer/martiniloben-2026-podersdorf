import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

export type Tab = 'home' | 'missions' | 'confirm' | 'admin'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      // Leuchtturm
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M10 6h4l1.5 15h-7z" />
        <path d="M9.5 6 12 3l2.5 3" />
        <path d="M9.2 11h5.6M8.8 16h6.4" />
        <path d="M4 7.5 8 8.5M20 7.5l-4 1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'missions',
    label: 'Missionen',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <rect x="4" y="5" width="11" height="15" rx="2" transform="rotate(-8 9.5 12.5)" />
        <rect x="9" y="4" width="11" height="15" rx="2" />
        <path d="M14.5 9.5v5M12 12h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'confirm',
    label: 'Bestätigungen',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
    ),
  },
]

export default function BottomNav({ tab, onChange, badge }: { tab: Tab; onChange: (t: Tab) => void; badge: number }) {
  const badgeRef = useRef<HTMLSpanElement>(null)

  // Badge "ploppt", sobald eine neue Anfrage reinkommt
  useGSAP(() => {
    if (badge > 0 && badgeRef.current) {
      gsap.fromTo(badgeRef.current, { scale: 0.3 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' })
    }
  }, { dependencies: [badge] })

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-400/15 bg-ink-900/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <li key={t.id}>
              <button
                onClick={() => onChange(t.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-[4.5rem] w-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
                  active ? 'text-gold-300' : 'text-cream-300/60'
                }`}
              >
                {active && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-gold-400" />}
                <span className="relative">
                  {t.icon}
                  {t.id === 'confirm' && badge > 0 && (
                    <span
                      ref={badgeRef}
                      className="absolute -top-1.5 -right-2.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-ink-900"
                      aria-label={`${badge} offene Bestätigungen`}
                    >
                      {badge}
                    </span>
                  )}
                </span>
                {t.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
