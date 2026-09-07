/**
 * The new-order chime, synthesised rather than shipped as an audio file.
 *
 * Two short notes from a `WebAudio` oscillator: no asset in the bundle, no network fetch at the
 * moment it needs to play, and nothing to 404. Swapping in a real sound later means changing
 * `playOrderAlert` alone.
 */

let context: AudioContext | null = null

type AudioContextCtor = typeof AudioContext

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  if (!context) {
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }

  return context
}

/**
 * Browsers start an `AudioContext` suspended until the user has interacted with the page, so the
 * first alert of a session would otherwise be silent. Calling this from any real user gesture
 * resumes it, making every later alert audible.
 *
 * Safe to call repeatedly; resuming an already-running context is a no-op.
 */
export function armAlertSound(): void {
  const ctx = getAudioContext()
  if (ctx?.state === 'suspended') void ctx.resume().catch(() => {})
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency

  // Ramped rather than switched: a gain that jumps to full and back produces an audible click
  // at each edge, which reads as a glitch rather than a notification.
  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration)

  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

/** The chime itself: two short notes, the second overlapping the first's tail. */
function schedule(ctx: AudioContext): void {
  const now = ctx.currentTime
  tone(ctx, 880, now, 0.18)
  tone(ctx, 1174.7, now + 0.16, 0.22)
}

/**
 * Plays the chime. Never throws and never reports failure: a blocked or unavailable sound must
 * cost nothing but the sound itself — the on-screen alert carries the message either way.
 */
export function playOrderAlert(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    if (ctx.state === 'suspended') {
      /*
       * Not yet unlocked by a user gesture. `resume()` settles asynchronously, so scheduling
       * notes now would queue them against a clock that isn't running — they'd either never
       * sound or fire late in a burst. Play only once it has actually resumed, and drop the
       * alert if the browser refuses; the toast has already carried the message.
       */
      void ctx
        .resume()
        .then(() => {
          if (ctx.state === 'running') schedule(ctx)
        })
        .catch(() => {})
      return
    }

    schedule(ctx)
  } catch {
    // Audio is decoration on top of the toast; a browser that refuses it changes nothing else.
  }
}
