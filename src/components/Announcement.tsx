import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Modal from './Modal'
import { useToast } from './Toast'
import { api, errorText } from '../lib/api'
import type { Settings } from '../lib/types'

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('de-AT', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : ''

/** Ansage-Banner auf der Startseite: Text + wer sie gemacht hat. */
export function AnnouncementBanner({ settings }: { settings: Settings }) {
  const ref = useRef<HTMLDivElement>(null)
  // bei neuer Ansage kurz aufleuchten lassen
  useGSAP(() => {
    if (settings.announcement) {
      gsap.fromTo(ref.current, { scale: 0.96, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2)' })
    }
  }, { dependencies: [settings.announcement, settings.announcementAt] })

  if (!settings.announcement) return null
  return (
    <div ref={ref} className="mx-5 mt-4 flex gap-3 rounded-2xl border border-gold-400/40 bg-gold-400/10 p-4" role="status">
      <span className="text-2xl leading-none">📣</span>
      <div className="min-w-0">
        <p className="text-[15px] leading-snug font-medium whitespace-pre-line text-cream-100">{settings.announcement}</p>
        {settings.announcementBy && (
          <p className="mt-1.5 text-xs font-semibold text-gold-300">
            — {settings.announcementBy}
            {settings.announcementAt && <span className="font-normal text-cream-300/70"> · {time(settings.announcementAt)}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

/** Fenster zum Schreiben/Entfernen einer Ansage (für Admin und freigeschaltete Spieler). */
export function AnnounceModal({ token, settings, onClose, onDone }: {
  token: string
  settings: Settings
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const toast = useToast()
  const [text, setText] = useState(settings.announcement)
  const [busy, setBusy] = useState(false)

  async function send(value: string, msg: string) {
    setBusy(true)
    try {
      await api.announce(token, value)
      await onDone()
      toast(msg)
      onClose()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="📣 Ansage an alle" onClose={onClose}>
      <p className="mb-3 text-sm text-cream-300">
        Erscheint sofort bei allen oben auf der Startseite – mit deinem Namen. Eine neue Ansage ersetzt die alte.
      </p>
      {settings.announcementBy && (
        <p className="mb-3 text-xs text-cream-300/70">Aktuell von <strong className="text-gold-300">{settings.announcementBy}</strong></p>
      )}
      <textarea className="field min-h-24 resize-none text-base" maxLength={200} value={text} autoFocus
        placeholder="z. B. 20 Uhr Treffpunkt Martinskeller 🍷" onChange={(e) => setText(e.target.value)} />
      <p className="mt-1 text-right text-xs text-cream-300/50">{text.length}/200</p>
      <div className="mt-3 grid gap-2.5">
        <button className="btn btn-gold w-full" disabled={busy || !text.trim() || text.trim() === settings.announcement}
          onClick={() => send(text, 'Ansage verschickt 📣')}>
          Ansage senden
        </button>
        {settings.announcement && (
          <button className="btn btn-ghost w-full" disabled={busy} onClick={() => send('', 'Ansage entfernt')}>
            Aktuelle Ansage entfernen
          </button>
        )}
      </div>
    </Modal>
  )
}
