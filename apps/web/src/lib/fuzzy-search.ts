const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g

/** Normalize Arabic/Latin text for forgiving search matching. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s@._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const prev = new Array<number>(b.length + 1)
  const curr = new Array<number>(b.length + 1)

  for (let j = 0; j <= b.length; j += 1) prev[j] = j

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]
  }

  return prev[b.length]
}

function fuzzyTokenScore(query: string, token: string): number {
  if (!query || !token) return 0
  if (query === token) return 100
  if (token.startsWith(query)) return 90
  if (token.includes(query)) return 76
  if (query.includes(token) && token.length >= 3) return 58

  const maxLen = Math.max(query.length, token.length)
  if (maxLen <= 2) return 0

  const distance = levenshteinDistance(query, token)
  const ratio = 1 - distance / maxLen

  if (ratio >= 0.78) return Math.round(62 + ratio * 30)
  if (ratio >= 0.62 && query.length >= 3) return Math.round(44 + ratio * 24)
  if (ratio >= 0.5 && query.length >= 4 && maxLen <= 16) return Math.round(36 + ratio * 16)

  return 0
}

/** Score how well `target` matches `query` (0–100). Higher = better. */
export function fuzzyMatchScore(query: string, target: string): number {
  const normalizedQuery = normalizeSearchText(query)
  const normalizedTarget = normalizeSearchText(target)

  if (!normalizedQuery || !normalizedTarget) return 0
  if (normalizedQuery === normalizedTarget) return 100
  if (normalizedTarget.startsWith(normalizedQuery)) return 94
  if (normalizedTarget.includes(normalizedQuery)) return 82

  const queryTokens = normalizedQuery.split(' ').filter(Boolean)
  const targetTokens = normalizedTarget.split(' ').filter(Boolean)

  if (queryTokens.length > 1) {
    const allTokensMatch = queryTokens.every((queryToken) =>
      targetTokens.some((targetToken) => fuzzyTokenScore(queryToken, targetToken) >= 48) ||
      fuzzyTokenScore(queryToken, normalizedTarget) >= 52,
    )
    if (allTokensMatch) return 70
  }

  const scores = [
    fuzzyTokenScore(normalizedQuery, normalizedTarget),
    ...targetTokens.map((token) => fuzzyTokenScore(normalizedQuery, token)),
  ]

  return Math.max(...scores, 0)
}

export function matchesFuzzySearch(query: string, target: string, minScore = 42): boolean {
  return fuzzyMatchScore(query, target) >= minScore
}

export function matchesFuzzySearchAny(query: string, targets: string[], minScore = 42): boolean {
  return targets.some((target) => matchesFuzzySearch(query, target, minScore))
}

export function rankFuzzySearch<T>(
  query: string,
  items: T[],
  getTargets: (item: T) => string[],
  minScore = 42,
): Array<{ item: T; score: number }> {
  return items
    .map((item) => {
      const score = Math.max(...getTargets(item).map((target) => fuzzyMatchScore(query, target)), 0)
      return { item, score }
    })
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)
}

export function bestFuzzyMatch<T>(
  query: string,
  items: T[],
  getTargets: (item: T) => string[],
  minScore = 42,
): { item: T; score: number } | null {
  return rankFuzzySearch(query, items, getTargets, minScore)[0] ?? null
}
