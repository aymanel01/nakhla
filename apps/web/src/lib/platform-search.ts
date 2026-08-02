import type { SearchIndexItem } from '@teaching-app/shared'
import { api } from '@/lib/api'

export const SEARCH_OPEN_STORAGE_KEY = 'nakhla-search-open'

export function storeSearchOpenPayload(payload: SearchIndexItem['openPayload']) {
  if (!payload || typeof window === 'undefined') return
  window.sessionStorage.setItem(SEARCH_OPEN_STORAGE_KEY, JSON.stringify(payload))
}

export function peekSearchOpenPayload(): SearchIndexItem['openPayload'] | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(SEARCH_OPEN_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SearchIndexItem['openPayload']
  } catch {
    return null
  }
}

export function clearSearchOpenPayload() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SEARCH_OPEN_STORAGE_KEY)
}

export function consumeSearchOpenPayload<T = SearchIndexItem['openPayload']>(): T | null {
  const payload = peekSearchOpenPayload()
  if (payload) clearSearchOpenPayload()
  return payload as T | null
}

export async function fetchSearchIndex(): Promise<SearchIndexItem[]> {
  const response = await api.get<{ items: SearchIndexItem[] }>('/search/index')
  return response.items || []
}
