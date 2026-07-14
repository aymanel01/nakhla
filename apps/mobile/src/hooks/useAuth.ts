import { useState, useEffect, useCallback } from 'react'
import type { User, LoginRequest, RegisterRequest } from '@teaching-app/shared'
import { api, getToken, deleteToken, setToken } from '@/lib/api'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  const checkAuth = useCallback(async () => {
    try {
      const token = await getToken('access_token')
      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false })
        return
      }
      const { user } = await api.get<{ user: User }>('/auth/me')
      setState({ user, isLoading: false, isAuthenticated: true })
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false })
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  const login = async (data: LoginRequest) => {
    const response = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/login',
      data
    )
    if (response.accessToken) {
      await setToken('access_token', response.accessToken)
    }
    if (response.refreshToken) {
      await setToken('refresh_token', response.refreshToken)
    }
    setState({ user: response.user, isLoading: false, isAuthenticated: true })
    return response
  }

  const register = async (data: RegisterRequest) => {
    const response = await api.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/register',
      data
    )
    if (response.accessToken) {
      await setToken('access_token', response.accessToken)
    }
    if (response.refreshToken) {
      await setToken('refresh_token', response.refreshToken)
    }
    setState({ user: response.user, isLoading: false, isAuthenticated: true })
    return response
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout errors
    }
    await deleteToken('access_token')
    await deleteToken('refresh_token')
    setState({ user: null, isLoading: false, isAuthenticated: false })
  }

  return {
    ...state,
    login,
    register,
    logout,
    checkAuth,
    isAdmin: state.user?.role === 'admin',
  }
}
