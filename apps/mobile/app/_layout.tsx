import { useEffect, useState, createContext, useContext } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import type { User } from '@teaching-app/shared'
import { api, getToken, deleteToken, setToken } from '@/lib/api'
import { colors } from '@/lib/colors'

SplashScreen.preventAutoHideAsync()

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  register: (fullName: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = await getToken('access_token')
      if (!token) {
        setIsLoading(false)
        SplashScreen.hideAsync()
        return
      }
      const { user } = await api.get<{ user: User }>('/auth/me')
      setUser(user)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
      SplashScreen.hideAsync()
    }
  }

  const login = async (email: string, password: string) => {
    const response = await api.post<{ user: User; accessToken?: string; refreshToken?: string }>(
      '/auth/login',
      { email, password }
    )
    if (response.accessToken) await setToken('access_token', response.accessToken)
    if (response.refreshToken) await setToken('refresh_token', response.refreshToken)
    setUser(response.user)
  }

  const register = async (fullName: string, email: string, password: string) => {
    const response = await api.post<{ user: User; accessToken?: string; refreshToken?: string }>(
      '/auth/register',
      { fullName, email, password }
    )
    if (response.accessToken) await setToken('access_token', response.accessToken)
    if (response.refreshToken) await setToken('refresh_token', response.refreshToken)
    setUser(response.user)
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    await deleteToken('access_token')
    await deleteToken('refresh_token')
    setUser(null)
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.light.background }}>
        <ActivityIndicator size="large" color={colors.light.primary} />
      </View>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
      }}
    >
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </AuthContext.Provider>
  )
}
