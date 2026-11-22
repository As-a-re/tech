'use client'

import { useEffect, useState } from 'react'
import { Square, Volume2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/client'

/** "Read to me": the uploaded recording, or the phone's own voice reading the story. */
export function ReadAloud({ audioUrl, text }: { audioUrl: string | null; text: string }) {
  const { t } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel() }, [])
  if (audioUrl) return <audio src={audioUrl} controls preload="none" className="w-full" data-read-aloud />
  if (typeof window !== 'undefined' && !('speechSynthesis' in window)) return null
  const toggle = () => {
    if (speaking) { speechSynthesis.cancel(); setSpeaking(false); return }
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-GB'
    u.rate = 0.9
    u.onend = () => setSpeaking(false)
    speechSynthesis.speak(u)
    setSpeaking(true)
  }
  return (
    <button type="button" onClick={toggle} data-read-aloud className="flex items-center gap-2 rounded-full bg-amber-300 px-5 py-3 text-lg font-black text-black shadow hover:bg-amber-200">
      {speaking ? <Square className="size-5" /> : <Volume2 className="size-6" />}{speaking ? t('kids.stop') : t('kids.readToMe')}
    </button>
  )
}
