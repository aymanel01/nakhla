import { useState, useEffect, useCallback } from 'react'
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '@teaching-app/shared'
import { api, ApiError } from '@/lib/api'

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
    const response = await api.post<AuthResponse>('/auth/login', data)
    setState({ user: response.user, isLoading: false, isAuthenticated: true })
    return response
  }

  const register = async (data: RegisterRequest) => {
    const response = await api.post<AuthResponse>('/auth/register', data)
    setState({ user: response.user, isLoading: false, isAuthenticated: true })
    return response
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore logout errors
    }
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

export { ApiError }
