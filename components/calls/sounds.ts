'use client'

/**
 * Ringtone (incoming) and ringback (outgoing) made with the browser's sound engine, so no audio files are needed.
 * Browsers only allow sound after the person has tapped something on the page; if not allowed, it stays silent.
 */
let ctx: AudioContext | null = null
let timer: ReturnType<typeof setInterval> | null = null

/** Phones only vibrate after the person has tapped the page once. */
const canVibrate = () => 'vibrate' in navigator && (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false

function tone(freqs: number[], ms: number, gain = 0.12) {
  if (!ctx) return
  const g = ctx.createGain()
  g.gain.value = gain
  g.connect(ctx.destination)
  const end = ctx.currentTime + ms / 1000
  for (const f of freqs) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    o.connect(g)
    o.start()
    o.stop(end)
  }
  g.gain.setValueAtTime(gain, end - 0.03)
  g.gain.linearRampToValueAtTime(0, end)
}

export function playRing(kind: 'incoming' | 'outgoing') {
  stopRing()
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch { return }
  const beat = () => {
    if (kind === 'incoming') {
      tone([660, 880], 350, 0.16); setTimeout(() => tone([660, 880], 350, 0.16), 500)
      if (canVibrate()) navigator.vibrate([400, 200, 400])
    } else tone([425], 1000, 0.08)
  }
  beat()
  timer = setInterval(beat, kind === 'incoming' ? 2500 : 4000)
}

export function stopRing() {
  if (timer) clearInterval(timer)
  timer = null
  if (canVibrate()) navigator.vibrate(0)
}

/** A short beep when a call ends. */
export function endBeep() {
  try { ctx ??= new AudioContext(); void ctx.resume(); tone([480], 180, 0.08); setTimeout(() => tone([480], 180, 0.08), 260) } catch { /* silent */ }
}
