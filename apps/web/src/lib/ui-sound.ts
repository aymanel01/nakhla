let sharedCtx: AudioContext | null = null
let lastHoverAt = 0

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null

  if (!sharedCtx) {
    sharedCtx = new AudioCtx()
  }

  return sharedCtx
}

function runInAudioContext(play: (ctx: AudioContext) => void) {
  const ctx = getAudioContext()
  if (!ctx) return

  const start = () => play(ctx)

  if (ctx.state === 'suspended') {
    void ctx.resume().then(start).catch(() => {})
    return
  }

  start()
}

function canPlayHoverSound() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/** Crisp UI click / tap — short noise tick, not a musical chime. */
export function playCardClickSound() {
  runInAudioContext((ctx) => {
    const now = ctx.currentTime
    const clickLength = 0.045

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * clickLength))
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - i / bufferSize, 2.2)
      data[i] = (Math.random() * 2 - 1) * decay
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3200
    filter.Q.value = 1.1

    const clickGain = ctx.createGain()
    clickGain.gain.setValueAtTime(0.42, now)
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + clickLength)

    noise.connect(filter)
    filter.connect(clickGain)
    clickGain.connect(ctx.destination)
    noise.start(now)
    noise.stop(now + clickLength)

    const thump = ctx.createOscillator()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(220, now)
    thump.frequency.exponentialRampToValueAtTime(90, now + 0.028)

    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(0.14, now)
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

    thump.connect(thumpGain)
    thumpGain.connect(ctx.destination)
    thump.start(now)
    thump.stop(now + 0.035)
  })
}

/** Soft hover tick for desktop pointer — lighter than click. */
export function playCardHoverSound() {
  if (!canPlayHoverSound()) return

  const nowMs = Date.now()
  if (nowMs - lastHoverAt < 90) return
  lastHoverAt = nowMs

  runInAudioContext((ctx) => {
    const now = ctx.currentTime
    const hoverLength = 0.028

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * hoverLength))
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - i / bufferSize, 3)
      data[i] = (Math.random() * 2 - 1) * decay
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 4200

    const hoverGain = ctx.createGain()
    hoverGain.gain.setValueAtTime(0.16, now)
    hoverGain.gain.exponentialRampToValueAtTime(0.001, now + hoverLength)

    noise.connect(filter)
    filter.connect(hoverGain)
    hoverGain.connect(ctx.destination)
    noise.start(now)
    noise.stop(now + hoverLength)

    const tick = ctx.createOscillator()
    tick.type = 'sine'
    tick.frequency.setValueAtTime(1400, now)
    tick.frequency.exponentialRampToValueAtTime(900, now + 0.02)

    const tickGain = ctx.createGain()
    tickGain.gain.setValueAtTime(0.04, now)
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.022)

    tick.connect(tickGain)
    tickGain.connect(ctx.destination)
    tick.start(now)
    tick.stop(now + 0.025)
  })
}
