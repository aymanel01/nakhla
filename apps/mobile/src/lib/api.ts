import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const API_BASE = Constants.expoConfig?.extra?.apiUrl || 'http://10.0.2.2:3000'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getToken(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function setToken(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value)
}

async function deleteToken(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key)
}

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const accessToken = await getToken('access_token')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  // Handle token in response headers (for login/register)
  const newAccessToken = response.headers.get('X-Access-Token')
  const newRefreshToken = response.headers.get('X-Refresh-Token')

  if (newAccessToken) {
    await setToken('access_token', newAccessToken)
  }
  if (newRefreshToken) {
    await setToken('refresh_token', newRefreshToken)
  }

  if (response.status === 401 && !endpoint.includes('/auth/')) {
    const refreshToken = await getToken('refresh_token')
    if (refreshToken) {
      const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshToken}`,
        },
      })

      if (refreshResponse.ok) {
        const newToken = refreshResponse.headers.get('X-Access-Token')
        if (newToken) {
          await setToken('access_token', newToken)
        }
        // Retry original request
        return fetchApi(endpoint, options)
      }
    }
    await deleteToken('access_token')
    await deleteToken('refresh_token')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new ApiError(response.status, error.message)
  }

  return response.json()
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown) =>
    fetchApi<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string) => fetchApi<T>(endpoint, { method: 'DELETE' }),
}

export { ApiError, setToken, getToken, deleteToken }
