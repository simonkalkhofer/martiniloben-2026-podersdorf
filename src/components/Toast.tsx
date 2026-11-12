import { createContext, useCallback, useContext, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null)
  const timer = useRef<number>(0)

  const show = useCallback((text: string) => {
    window.clearTimeout(timer.current)
    setMsg({ text, id: Date.now() })
    timer.current = window.setTimeout(() => setMsg(null), 3200)
  }, [])

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <ToastView key={msg.id} text={msg.text} />}
    </ToastCtx.Provider>
  )
}

function ToastView({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    gsap.from(ref.current, { y: -40, autoAlpha: 0, duration: 0.4, ease: 'back.out(1.6)' })
  }, { scope: ref })
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex justify-center px-4">
      <div
        ref={ref}
        role="status"
        className="max-w-sm rounded-2xl border border-gold-400/30 bg-wine-800/95 px-4 py-3 text-center text-sm font-medium text-cream-100 shadow-xl backdrop-blur"
      >
        {text}
      </div>
    </div>
  )
}
