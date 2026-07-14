const API_BASE = '/api'

interface FetchOptions extends RequestInit {
  skipAuth?: boolean
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function parseError(response: Response, fallback: string) {
  const error = await response.json().catch(() => ({ message: fallback }))
  return error.message || fallback
}

async function refreshSession() {
  const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })

  return refreshResponse.ok
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOptions } = options

  const makeRequest = () => fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  })

  let response = await makeRequest()

  if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/')) {
    const refreshed = await refreshSession()
    if (refreshed) {
      response = await makeRequest()
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response, 'Request failed'))
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T>(endpoint: string, data?: unknown, options?: FetchOptions) =>
    fetchApi<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    fetchApi<T>(endpoint, { ...options, method: 'DELETE' }),

  upload: async <T>(endpoint: string, formData: FormData, options?: FetchOptions) => {
    const { skipAuth, headers, ...fetchOptions } = options || {}

    // Catch unreadable files (0 bytes) before sending — usually a OneDrive/cloud
    // "online-only" placeholder or a file locked/open in another program. The
    // raw backend error ("File is empty") is confusing, so explain it clearly.
    for (const value of formData.values()) {
      if (value instanceof File && value.size === 0) {
        throw new ApiError(
          400,
          `تعذّرت قراءة الملف «${value.name || 'بدون اسم'}» (٠ بايت). تأكد أن الملف محفوظ محلياً على الجهاز (وليس ملف OneDrive/سحابة غير محمَّل)، وأنه غير مفتوح في برنامج آخر، ثم أعد اختياره.`,
        )
      }
    }

    const makeRequest = () => fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      method: 'POST',
      body: formData,
      credentials: 'include',
      // Don't set Content-Type header - let the browser set it with the correct boundary
      headers: {
        ...headers,
      },
    })

  let response = await makeRequest()

  if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/')) {
    const refreshed = await refreshSession()
    if (refreshed) {
      response = await makeRequest()
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response, 'Upload failed'))
  }

    return response.json() as Promise<T>
  },
}

export { ApiError }

export function getWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}
