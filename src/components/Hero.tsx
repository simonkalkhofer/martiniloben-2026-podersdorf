import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/**
 * Stimmungsbild: Abendrot über dem Neusiedlersee, Podersdorfer Leuchtturm
 * an der Mole, Schilf und Weinreben im Vordergrund. Komplett als SVG,
 * animiert mit einer GSAP-Timeline.
 */
export default function Hero({ children }: { children?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add(
      { motion: '(prefers-reduced-motion: no-preference)' },
      () => {
        const intro = gsap.timeline({ defaults: { duration: 0.9, ease: 'power3.out' } })
        intro
          .from('.h-sun', { y: 40, autoAlpha: 0, duration: 1.4 })
          .from('.h-lighthouse', { y: 30, autoAlpha: 0 }, '<0.2')
          .from('.h-vines', { y: 40, autoAlpha: 0 }, '<0.1')
          .from('.h-title > *', { y: 18, autoAlpha: 0, stagger: 0.12 }, '<0.3')
          .addLabel('loop')

        // Leuchtfeuer: Lichtkegel schwenkt hin und her, Lampe pulsiert
        gsap.fromTo('.h-beam', { rotation: -18 }, {
          rotation: 18, transformOrigin: '0% 50%', duration: 3.2, ease: 'sine.inOut', repeat: -1, yoyo: true,
        })
        gsap.to('.h-lamp', { opacity: 0.55, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' })
        // Wellen und Schilf
        gsap.to('.h-wave', { x: 18, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: 0.6 })
        gsap.to('.h-reed', {
          rotation: 4, transformOrigin: '50% 100%', duration: 2.4, repeat: -1, yoyo: true,
          ease: 'sine.inOut', stagger: { each: 0.15, from: 'random' },
        })
        gsap.to('.h-star', { opacity: 0.2, duration: 1.6, repeat: -1, yoyo: true, stagger: { each: 0.4, from: 'random' } })
      },
    )
  }, { scope: root })

  return (
    <div ref={root} className="relative overflow-hidden rounded-b-[2rem]">
      <svg viewBox="0 0 400 300" className="block h-auto w-full" role="img" aria-label="Abendstimmung am Neusiedlersee mit dem Podersdorfer Leuchtturm">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1c0d10" />
            <stop offset="0.45" stopColor="#5c1a2b" />
            <stop offset="0.8" stopColor="#c0562f" />
            <stop offset="1" stopColor="#e0a83c" />
          </linearGradient>
          <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7a3a2c" />
            <stop offset="1" stopColor="#1c1418" />
          </linearGradient>
          <radialGradient id="sunGlow">
            <stop offset="0" stopColor="#f8d98a" />
            <stop offset="0.5" stopColor="#f0c56a" stopOpacity="0.6" />
            <stop offset="1" stopColor="#f0c56a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fbe7a8" stopOpacity="0.75" />
            <stop offset="1" stopColor="#fbe7a8" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="400" height="300" fill="url(#sky)" />
        {[[40, 30], [90, 55], [150, 22], [230, 40], [300, 18], [360, 48], [330, 75]].map(([x, y]) => (
          <circle key={`${x}-${y}`} className="h-star" cx={x} cy={y} r="1.2" fill="#fbf6ec" />
        ))}

        {/* Sonne, halb im See versunken */}
        <g className="h-sun">
          <circle cx="120" cy="190" r="70" fill="url(#sunGlow)" />
          <circle cx="120" cy="190" r="26" fill="#f6cf74" />
        </g>

        {/* Ferne Uferlinie */}
        <path d="M0 186 Q60 180 120 185 T250 182 T400 186 V196 H0Z" fill="#3f1621" opacity="0.8" />

        {/* See */}
        <rect y="190" width="400" height="110" fill="url(#lake)" />
        <g stroke="#f0c56a" strokeLinecap="round" opacity="0.55">
          <path className="h-wave" d="M95 204h50M88 214h64M100 226h40M108 240h24" strokeWidth="2" />
          <path className="h-wave" d="M20 222h30M200 212h40M250 232h30M40 250h26" strokeWidth="1.4" opacity="0.6" />
        </g>

        {/* Mole + Leuchtturm */}
        <g className="h-lighthouse">
          <path d="M255 214 L400 206 V218 L255 222Z" fill="#2a1418" />
          <g className="h-beam" transform="translate(316 120)">
            <path d="M0 0 L170 -30 L170 30Z" fill="url(#beam)" />
          </g>
          <g transform="translate(300 112)">
            <path d="M8 26 L24 26 L28 102 L4 102Z" fill="#f5ecd9" />
            <path d="M6.6 52 L25.4 52 L26 64 L6 64Z" fill="#9b2f46" />
            <path d="M5.4 80 L26.6 80 L27.2 92 L4.8 92Z" fill="#9b2f46" />
            <rect x="4" y="22" width="24" height="5" rx="1" fill="#2a1418" />
            <rect className="h-lamp" x="9" y="8" width="14" height="14" rx="2" fill="#fbe7a8" />
            <path d="M6 9 L16 0 L26 9Z" fill="#9b2f46" />
            <rect x="14" y="78" width="4" height="7" rx="1" fill="#3f1621" />
          </g>
          {/* Spiegelung */}
          <path d="M306 216 L326 216 L322 250 L310 250Z" fill="#f5ecd9" opacity="0.08" />
        </g>

        {/* Schilfgürtel */}
        <g stroke="#2a1418" strokeWidth="2.2" strokeLinecap="round">
          {[8, 16, 24, 36, 44, 210, 222, 234, 380, 392].map((x, i) => (
            <g key={x} className="h-reed">
              <path d={`M${x} 300 Q${x + 2} ${262 - (i % 3) * 8} ${x + 4} ${244 - (i % 3) * 10}`} fill="none" />
              <ellipse cx={x + 4} cy={244 - (i % 3) * 10} rx="2.4" ry="6" fill="#3f1621" stroke="none" />
            </g>
          ))}
        </g>

        {/* Weinreben im Vordergrund */}
        <g className="h-vines">
          <path d="M60 300 C80 268 70 250 92 236 S130 250 150 300Z" fill="#1c0d10" />
          <path d="M92 236 c-10-14 4-26 14-18 c6-12 22-6 18 6 c12 2 10 18-2 18" fill="#3f1621" />
          <g fill="#7a2236">
            {[[104, 262], [112, 262], [120, 262], [108, 270], [116, 270], [112, 278], [124, 270]].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="4.6" />
            ))}
          </g>
          <g fill="#f0c56a" opacity="0.35">
            <circle cx="102.5" cy="260.5" r="1.3" /><circle cx="110.5" cy="260.5" r="1.3" /><circle cx="106.5" cy="268.5" r="1.3" />
          </g>
          <path d="M112 252 q2-8 8-10" stroke="#3f1621" strokeWidth="2" fill="none" />
        </g>

      </svg>

      {/* Titel */}
      <div className="h-title absolute inset-x-0 top-0 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <p className="text-[11px] font-semibold tracking-[0.25em] text-gold-300/90 uppercase">Martiniloben 2026 · Podersdorf</p>
        <h1 className="mt-1 font-display text-[1.9rem] leading-tight font-extrabold text-cream-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
          Geheime Missionen
        </h1>
        {children}
      </div>
    </div>
  )
}
