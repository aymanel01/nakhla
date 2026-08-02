/** Seconds to shift highlight forward so it keeps up with narration. */
const HIGHLIGHT_LEAD_SECONDS = 1.75

export interface ReadAlongSyncOptions {
  /** Extra seconds added to playback time when computing highlight position. */
  leadSeconds?: number
  syncStart?: number
  syncEnd?: number
}

export function tokenizeReadAlongText(text: string): string[] {
  return (text.match(/\S+/g) || []).filter(Boolean)
}

export function computeReadAlongProgress(
  body: string,
  currentTime: number,
  duration: number,
  options: ReadAlongSyncOptions = {},
): number {
  if (duration <= 0 || !body.trim()) return 0

  const lead = options.leadSeconds ?? HIGHLIGHT_LEAD_SECONDS
  const syncStart = options.syncStart ?? 0
  const syncEnd = options.syncEnd ?? 0
  const adjustedTime = currentTime + lead
  const windowStart = syncStart
  const windowEnd = Math.max(windowStart + 0.5, duration - syncEnd)

  if (adjustedTime <= windowStart) return 0
  if (adjustedTime >= windowEnd) return 1
  return (adjustedTime - windowStart) / (windowEnd - windowStart)
}

export function progressToActiveWordCount(
  text: string,
  progress: number,
): number {
  const wordCount = tokenizeReadAlongText(text).length
  if (wordCount === 0) return 0

  const clamped = Math.min(Math.max(progress, 0), 1)
  return Math.min(wordCount, Math.ceil(clamped * wordCount))
}
