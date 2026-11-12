import { useRef } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/** Bottom-Sheet-Modal, gleitet von unten herein. */
export default function Modal({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    gsap.timeline({ defaults: { duration: 0.35 } })
      .from('.backdrop', { autoAlpha: 0 })
      .from('.sheet', { yPercent: 100, ease: 'power3.out' }, '<')
  }, { scope: root })

  return createPortal(
    <div ref={root} className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="backdrop absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="sheet relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-gold-400/25 bg-ink-900 px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-ink-600" />
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-cream-100">{title}</h2>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-ink-700 text-cream-200" aria-label="Schließen">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
