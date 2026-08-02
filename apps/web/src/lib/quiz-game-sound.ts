let sharedCtx: AudioContext | null = null
let doorOpenAudio: HTMLAudioElement | null = null
let doorOpenReady = false
let gamePlayAudio: HTMLAudioElement | null = null
let gamePlayReady = false

const DOOR_OPEN_SRC = '/quiz-sounds/moroccan-door-open.mp3'
const GAME_PLAY_SRC = '/quiz-sounds/moroccan-game-play.mp3'

type GamePlaySession = {
  stop: () => void
  setDucked: (ducked: boolean) => void
}

let activeGamePlaySession: GamePlaySession | null = null

function getAudioContext() {
  if (typeof window === 'undefined') return null

  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null

  if (!sharedCtx) sharedCtx = new AudioCtx()
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

function preloadDoorOpenSample() {
  if (typeof window === 'undefined' || doorOpenAudio) return
  doorOpenAudio = new Audio(DOOR_OPEN_SRC)
  doorOpenAudio.preload = 'auto'
  doorOpenAudio.load()
  doorOpenAudio.addEventListener(
    'canplaythrough',
    () => {
      doorOpenReady = true
    },
    { once: true },
  )
  doorOpenAudio.addEventListener('error', () => {
    doorOpenReady = false
  })
}

function preloadGamePlaySample() {
  if (typeof window === 'undefined' || gamePlayAudio) return
  gamePlayAudio = new Audio(GAME_PLAY_SRC)
  gamePlayAudio.preload = 'auto'
  gamePlayAudio.load()
  gamePlayAudio.addEventListener(
    'canplaythrough',
    () => {
      gamePlayReady = true
    },
    { once: true },
  )
  gamePlayAudio.addEventListener('error', () => {
    gamePlayReady = false
  })
}

if (typeof window !== 'undefined') {
  preloadDoorOpenSample()
  preloadGamePlaySample()
}

function playSampleDoorOpen(volume = 0.72) {
  if (!doorOpenAudio || !doorOpenReady) return false
  const clip = doorOpenAudio.cloneNode(true) as HTMLAudioElement
  clip.volume = volume
  void clip.play().catch(() => {})
  return true
}

function playCreak(ctx: AudioContext, destination: AudioNode, start: number) {
  const length = Math.floor(ctx.sampleRate * 0.55)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < length; i++) {
    const t = i / length
    const envelope = Math.sin(Math.PI * t) * (1 - t * 0.35)
    data[i] = (Math.random() * 2 - 1) * envelope
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(180, start)
  filter.frequency.exponentialRampToValueAtTime(920, start + 0.42)
  filter.Q.value = 0.8

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.22, start + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55)

  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  source.start(start)
  source.stop(start + 0.56)
}

function playDarbukaHit(
  ctx: AudioContext,
  destination: AudioNode,
  time: number,
  kind: 'doum' | 'tek',
  volume: number,
) {
  const osc = ctx.createOscillator()
  osc.type = kind === 'doum' ? 'sine' : 'triangle'
  osc.frequency.setValueAtTime(kind === 'doum' ? 95 : 210, time)
  osc.frequency.exponentialRampToValueAtTime(kind === 'doum' ? 58 : 140, time + 0.05)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + (kind === 'doum' ? 0.16 : 0.09))

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = kind === 'doum' ? 280 : 1800

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  osc.start(time)
  osc.stop(time + 0.18)

  if (kind === 'tek') {
    const snap = ctx.createBufferSource()
    const snapLength = Math.floor(ctx.sampleRate * 0.025)
    const snapBuffer = ctx.createBuffer(1, snapLength, ctx.sampleRate)
    const snapData = snapBuffer.getChannelData(0)
    for (let i = 0; i < snapLength; i++) {
      snapData[i] = (Math.random() * 2 - 1) * (1 - i / snapLength)
    }
    snap.buffer = snapBuffer
    const snapGain = ctx.createGain()
    snapGain.gain.setValueAtTime(volume * 0.35, time)
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03)
    const snapFilter = ctx.createBiquadFilter()
    snapFilter.type = 'highpass'
    snapFilter.frequency.value = 2200
    snap.connect(snapFilter)
    snapFilter.connect(snapGain)
    snapGain.connect(destination)
    snap.start(time)
    snap.stop(time + 0.04)
  }
}

function playDarbukaRoll(ctx: AudioContext, destination: AudioNode, start: number) {
  const pattern: Array<{ offset: number; kind: 'doum' | 'tek'; volume: number }> = [
    { offset: 0, kind: 'doum', volume: 0.34 },
    { offset: 0.11, kind: 'tek', volume: 0.18 },
    { offset: 0.2, kind: 'doum', volume: 0.28 },
    { offset: 0.28, kind: 'tek', volume: 0.16 },
    { offset: 0.34, kind: 'tek', volume: 0.14 },
    { offset: 0.42, kind: 'doum', volume: 0.3 },
    { offset: 0.5, kind: 'tek', volume: 0.17 },
    { offset: 0.56, kind: 'tek', volume: 0.15 },
    { offset: 0.62, kind: 'doum', volume: 0.26 },
  ]

  for (const hit of pattern) {
    playDarbukaHit(ctx, destination, start + hit.offset, hit.kind, hit.volume)
  }
}

function playOudPluck(
  ctx: AudioContext,
  destination: AudioNode,
  time: number,
  frequency: number,
  volume: number,
  duration = 0.42,
) {
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(frequency, time)

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration)

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2400, time)
  filter.frequency.exponentialRampToValueAtTime(650, time + duration)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  osc.start(time)
  osc.stop(time + duration + 0.02)
}

function playChiriq(ctx: AudioContext, destination: AudioNode, time: number) {
  const partials = [880, 1320, 1760]
  for (const [index, freq] of partials.entries()) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(0.08 - index * 0.015, time + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.55)
    osc.connect(gain)
    gain.connect(destination)
    osc.start(time)
    osc.stop(time + 0.58)
  }
}

/** Hijaz-style oud phrase used for palace door openings. */
function synthesizeMoroccanDoorOpen(ctx: AudioContext) {
  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  playCreak(ctx, master, now)
  playDarbukaRoll(ctx, master, now + 0.06)

  // Maqam Hijaz on D: D, Eb, F#, G, A
  const phrase = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 277.18]
  phrase.forEach((freq, index) => {
    playOudPluck(ctx, master, now + 0.18 + index * 0.11, freq, 0.16 - index * 0.008, 0.38)
  })

  playChiriq(ctx, master, now + 1.05)
}

/** Traditional Moroccan door opening — sample if available, otherwise synthesized oud + darbuka. */
export function playMoroccanDoorOpen() {
  if (playSampleDoorOpen()) return
  runInAudioContext(synthesizeMoroccanDoorOpen)
}

/** Short door tap for in-map stage doors (same palette, quicker). */
export function playMoroccanStageDoorOpen() {
  if (playSampleDoorOpen(0.58)) return
  runInAudioContext((ctx) => {
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.82
    master.connect(ctx.destination)

    playCreak(ctx, master, now)
    playDarbukaHit(ctx, master, now + 0.05, 'doum', 0.3)
    playDarbukaHit(ctx, master, now + 0.13, 'tek', 0.16)
    playDarbukaHit(ctx, master, now + 0.2, 'tek', 0.14)
    playOudPluck(ctx, master, now + 0.12, 185, 0.14, 0.28)
    playOudPluck(ctx, master, now + 0.24, 220, 0.12, 0.24)
    playChiriq(ctx, master, now + 0.42)
  })
}

export function playQuizTone(type: 'win' | 'bonus' | 'lose') {
  runInAudioContext((ctx) => {
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.value = 0.045

    const notes =
      type === 'bonus'
        ? [659, 783, 988]
        : type === 'lose'
          ? [392, 330, 262]
          : [523, 659, 783, 1046]

    const now = ctx.currentTime
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      osc.type = type === 'lose' ? 'sine' : 'triangle'
      osc.frequency.value = freq
      osc.connect(gain)
      const start = now + index * 0.1
      osc.start(start)
      osc.stop(start + 0.14)
    })
  })
}

function playGameplayPattern(ctx: AudioContext, destination: AudioNode, start: number, intensity: number) {
  const rhythm: Array<{ offset: number; kind: 'doum' | 'tek'; volume: number }> = [
    { offset: 0, kind: 'doum', volume: 0.16 * intensity },
    { offset: 0.36, kind: 'tek', volume: 0.08 * intensity },
    { offset: 0.72, kind: 'doum', volume: 0.14 * intensity },
    { offset: 1.08, kind: 'tek', volume: 0.07 * intensity },
    { offset: 1.32, kind: 'tek', volume: 0.06 * intensity },
    { offset: 1.68, kind: 'doum', volume: 0.13 * intensity },
    { offset: 2.04, kind: 'tek', volume: 0.07 * intensity },
    { offset: 2.52, kind: 'doum', volume: 0.12 * intensity },
  ]

  for (const hit of rhythm) {
    playDarbukaHit(ctx, destination, start + hit.offset, hit.kind, hit.volume)
  }

  const melody = [
    { offset: 0.12, freq: 146.83, volume: 0.05 },
    { offset: 0.84, freq: 155.56, volume: 0.045 },
    { offset: 1.56, freq: 185.0, volume: 0.05 },
    { offset: 2.28, freq: 220.0, volume: 0.048 },
  ]

  for (const note of melody) {
    playOudPluck(ctx, destination, start + note.offset, note.freq, note.volume * intensity, 0.82)
  }
}

function startSampleGamePlaySound(): GamePlaySession | null {
  if (!gamePlayAudio || !gamePlayReady) return null

  const audio = gamePlayAudio.cloneNode(true) as HTMLAudioElement
  audio.loop = true
  audio.volume = 0.34
  void audio.play().catch(() => {})

  let ducked = false
  return {
    setDucked(nextDucked) {
      ducked = nextDucked
      audio.volume = ducked ? 0.1 : 0.34
    },
    stop() {
      audio.pause()
      audio.currentTime = 0
    },
  }
}

function startSynthesizedGamePlaySound(): GamePlaySession {
  let stopped = false
  let timer: number | null = null
  let ducked = false
  let masterGain: GainNode | null = null
  const baseVolume = 0.9
  const duckedVolume = 0.35

  const applyVolume = (ctx: AudioContext) => {
    if (!masterGain) return
    masterGain.gain.setValueAtTime(ducked ? duckedVolume : baseVolume, ctx.currentTime)
  }

  const tick = () => {
    if (stopped) return
    runInAudioContext((ctx) => {
      if (!masterGain) {
        masterGain = ctx.createGain()
        masterGain.connect(ctx.destination)
      }
      applyVolume(ctx)
      playGameplayPattern(ctx, masterGain, ctx.currentTime, ducked ? 0.72 : 1)
    })
    timer = window.setTimeout(tick, 3200)
  }

  tick()

  return {
    setDucked(nextDucked) {
      ducked = nextDucked
      runInAudioContext((ctx) => applyVolume(ctx))
    },
    stop() {
      stopped = true
      if (timer !== null) window.clearTimeout(timer)
      masterGain?.disconnect()
      masterGain = null
    },
  }
}

/** Looping Moroccan gameplay ambience while exploring / playing the palace map. */
export function startMoroccanGamePlaySound(): () => void {
  activeGamePlaySession?.stop()
  activeGamePlaySession = startSampleGamePlaySound() ?? startSynthesizedGamePlaySound()

  return () => {
    activeGamePlaySession?.stop()
    activeGamePlaySession = null
  }
}

/** Lower gameplay music while answering questions or reading result popups. */
export function setMoroccanGamePlayDucked(ducked: boolean) {
  activeGamePlaySession?.setDucked(ducked)
}
