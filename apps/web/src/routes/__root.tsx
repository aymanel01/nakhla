import { createRootRoute, Link, Outlet, useNavigate, useLocation } from '@tanstack/react-router'
import { useState, useEffect, createContext, useContext, useRef, useMemo } from 'react'
import type { User, RegisterResponse } from '@teaching-app/shared'
import { api, ApiError, getWebSocketUrl } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User as UserIcon, LogOut, Camera, Save, Search, Radio, Home, Sparkles, Users, MessageCircle, FileText, Palette, HelpCircle, Mail, Phone, Bell, X } from 'lucide-react'
interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  register: (fullName: string, email: string, password: string) => Promise<RegisterResponse>
  updateProfile: (data: { fullName?: string; profilePhotoUrl?: string | null }) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

type QuickLink = {
  label: string
  keywords: string[]
  to: string
  hash?: string
  icon: typeof Home
}

function scoreQuickLink(item: QuickLink, query: string): number {
  const terms = [item.label, ...item.keywords].map((term) => term.trim().toLowerCase()).filter(Boolean)
  let best = 0
  for (const term of terms) {
    if (term === query) best = Math.max(best, 100)
    else if (term.startsWith(query)) best = Math.max(best, 80)
    else if (term.includes(query)) best = Math.max(best, 60)
    else if (query.includes(term) && term.length >= 3) best = Math.max(best, 40)
  }
  return best
}

type RealtimeNotification = {
  id: string
  title: string
  message: string
  kind: 'info' | 'success' | 'chat' | 'admin'
}

function getNotificationFromEvent(type: string, data: any, user: User | null): Omit<RealtimeNotification, 'id'> | null {
  const actor = data?.userFullName || data?.userEmail || data?.fromName || 'مستخدم'
  const title = data?.title || data?.exerciseTitle || data?.name || ''

  if (type === 'chat:message') {
    return { title: 'رسالة جديدة في المحادثة العامة', message: `${actor}: ${data?.content || data?.fileName || 'ملف مرفق'}`, kind: 'chat' }
  }
  if (type === 'group:message') {
    return { title: 'رسالة جديدة في مجموعة', message: `${actor}: ${data?.content || data?.fileName || 'ملف مرفق'}`, kind: 'chat' }
  }
  if (type === 'exercise:submitted' && user?.role === 'admin') {
    return { title: 'جواب جديد في تقويم الوحدة', message: `${actor} أرسل جواب ${title ? `على: ${title}` : ''}`, kind: 'success' }
  }
  if (type === 'exercise:corrected' && data?.userId === user?.id) {
    return { title: 'وصل تصحيح جديد', message: title ? `تم تصحيح جوابك في: ${title}` : 'الأستاذ أرسل لك تصحيحاً جديداً', kind: 'success' }
  }
  if (type === 'exercise:created') {
    return { title: 'تقويم جديد', message: title ? `الأستاذ أضاف: ${title}` : 'الأستاذ أضاف تقويماً جديداً', kind: 'admin' }
  }
  if (type === 'exercise:updated') {
    return { title: 'تحديث في تقويم الوحدة', message: title ? `تم تحديث: ${title}` : 'تم تحديث تقويم الوحدة', kind: 'admin' }
  }
  if (type === 'lecture:created') {
    return { title: 'محتوى جديد في المكتبة الرقمية', message: title ? `تمت إضافة: ${title}` : 'تمت إضافة محتوى جديد', kind: 'admin' }
  }
  if (type === 'homework:created') {
    return { title: 'مشروع جديد للمجموعات', message: title ? `تمت إضافة: ${title}` : 'تمت إضافة مشروع جديد', kind: 'admin' }
  }
  if (type === 'group:created') {
    return { title: 'مجموعة جديدة', message: title ? `تم إنشاء مجموعة: ${title}` : 'تم إنشاء مجموعة جديدة', kind: 'admin' }
  }
  if (type === 'resource:created') {
    return { title: 'إبداع جديد للتلاميذ', message: title ? `تمت إضافة: ${title}` : 'تمت إضافة إبداع جديد', kind: 'admin' }
  }
  if (type === 'student-creation:created') {
    return { title: 'إبداع جديد', message: title ? `تمت إضافة: ${title}` : 'تمت إضافة إبداع جديد', kind: 'admin' }
  }
  if (type === 'quiz:created' || type === 'quiz:updated') {
    return { title: 'تحديث في أبواب القصر', message: title ? `تم تحديث: ${title}` : 'تم تحديث لعبة أبواب القصر', kind: 'admin' }
  }
  if (type === 'registration:requested' && user?.role === 'admin') {
    return { title: 'طلب تسجيل جديد', message: `${actor} يطلب إنشاء حساب وينتظر الموافقة.`, kind: 'admin' }
  }
  if (type === 'admin-content:created') {
    return { title: 'محتوى جديد من الأستاذ', message: 'تمت إضافة محتوى جديد في المجالات.', kind: 'admin' }
  }
  if (type === 'admin-content:updated') {
    return { title: 'تحديث محتوى من الأستاذ', message: 'تم تعديل محتوى في المجالات.', kind: 'admin' }
  }
  return null
}

function NotificationCenter({ user }: { user: User | null }) {
  const [items, setItems] = useState<RealtimeNotification[]>([])
  const timersRef = useRef<number[]>([])

  const dismiss = (id: string) => setItems((prev) => prev.filter((current) => current.id !== id))

  useEffect(() => {
    if (!user) return
    const ws = new WebSocket(getWebSocketUrl())

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string; data?: any }
        if (!payload.type || payload.type === 'connected' || payload.type.startsWith('call:')) return
        const notification = getNotificationFromEvent(payload.type, payload.data, user)
        if (!notification) return
        const item = { ...notification, id: `${payload.type}-${Date.now()}-${Math.random().toString(36).slice(2)}` }
        setItems((prev) => [item, ...prev].slice(0, 5))
        // Auto-dismiss the toast after 1.7s so they don't pile up forever.
        const timer = window.setTimeout(() => dismiss(item.id), 1700)
        timersRef.current.push(timer)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(notification.title, { body: notification.message })
        }
      } catch (err) {
        console.warn('Invalid notification event:', err)
      }
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined)
    }

    return () => {
      ws.close()
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    }
  }, [user])

  if (!items.length) return null

  return (
    <div className="fixed left-3 z-[80] w-[min(360px,calc(100vw-24px))] space-y-2 max-md:top-[calc(var(--app-chrome-h)+0.5rem)] top-[132px]" dir="rtl">
      {items.map((item) => (
        <div key={item.id} className="animate-in slide-in-from-left-3 rounded-2xl border border-emerald-200 bg-white/95 p-3 text-right shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-slate-900">{item.title}</div>
              <div className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{item.message}</div>
            </div>
            <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => dismiss(item.id)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function RootComponent() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileFile, setProfileFile] = useState<File | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [searchFeedback, setSearchFeedback] = useState('')
  const profileFileRef = useRef<HTMLInputElement | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const hideMainHeader = location.pathname === '/welcome'

  // Publish the live header height as a CSS variable so the section nav bar can
  // pin itself right under the sticky header on every screen size without guessing pixels.
  useEffect(() => {
    const header = headerRef.current
    if (!header) {
      document.documentElement.style.setProperty('--app-header-h', '0px')
      return
    }
    const syncHeaderHeight = () => {
      document.documentElement.style.setProperty('--app-header-h', `${header.offsetHeight}px`)
    }
    syncHeaderHeight()
    const observer = new ResizeObserver(syncHeaderHeight)
    observer.observe(header)
    window.addEventListener('resize', syncHeaderHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncHeaderHeight)
    }
  }, [user, hideMainHeader])

  const scrollToFooter = () => {
    // "تواصل" slides the page down to the footer instead of routing away.
    const footer = document.querySelector('footer')
    if (footer) {
      footer.scrollIntoView({ behavior: 'smooth', block: 'end' })
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }
  }

  const checkAuth = async () => {
    try {
      const { user } = await api.get<{ user: User }>('/auth/me')
      setUser(user)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null)
      console.warn('Auth check failed without logging out:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const { user } = await api.post<{ user: User }>('/auth/login', { email, password })
    setUser(user)
  }

  const register = async (fullName: string, email: string, password: string) => {
    // New accounts stay pending until an admin approves them — no session is created here.
    return api.post<RegisterResponse>('/auth/register', { fullName, email, password })
  }

  const updateProfile = async (data: { fullName?: string; profilePhotoUrl?: string | null }) => {
    const { user } = await api.patch<{ user: User }>('/auth/profile', data)
    setUser(user)
  }

  const openProfile = () => {
    setProfileName(user?.fullName || user?.email?.split('@')[0] || '')
    setProfileFile(null)
    setProfileError('')
    setProfileOpen(true)
  }

  const saveProfile = async () => {
    if (!profileName.trim()) {
      setProfileError('الاسم الكامل ضروري')
      return
    }
    setProfileSaving(true)
    setProfileError('')
    try {
      let profilePhotoUrl = user?.profilePhotoUrl ?? null
      if (profileFile) {
        const fd = new FormData()
        fd.append('file', profileFile)
        const uploaded = await api.upload<{ file: { fileUrl: string } }>('/uploads/profile', fd)
        profilePhotoUrl = uploaded.file.fileUrl
      }
      await updateProfile({ fullName: profileName.trim(), profilePhotoUrl })
      setProfileOpen(false)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'تعذر تعديل الملف الشخصي')
    } finally {
      setProfileSaving(false)
    }
  }

  const logout = async () => {
    await api.post('/auth/logout')
    setUser(null)
    navigate({ to: '/login' })
  }

  const authValue: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    updateProfile,
    logout,
    checkAuth,
  }

  const quickLinks = useMemo<QuickLink[]>(() => {
    const items: QuickLink[] = [
      { label: 'الرئيسية', keywords: ['الرئيسية', 'raissiya', 'home', 'نخلة'], to: '/home', icon: Home },
      { label: 'المجالات', keywords: ['المجالات', 'مجال', 'محتوى', 'important'], to: '/important-content', hash: 'social-economic', icon: Sparkles },
      {
        label: 'المجال الاجتماعي والاقتصادي',
        keywords: ['المجال الاجتماعي والاقتصادي', 'اجتماعي اقتصادي', 'اجتماعي', 'اقتصادي', 'social-economic'],
        to: '/important-content',
        hash: 'social-economic',
        icon: Sparkles,
      },
      {
        label: 'فهم المقروء',
        keywords: ['فهم المقروء', 'مقروء', 'قراءة', 'reading', 'تمثال', 'المرمر', 'المرأة البئيسة'],
        to: '/important-content',
        hash: 'social-economic--reading',
        icon: Sparkles,
      },
      {
        label: 'فهم المسموع',
        keywords: ['فهم المسموع', 'مسموع', 'استماع', 'listening', 'سمع', 'مسموع'],
        to: '/important-content',
        hash: 'social-economic--listening',
        icon: Sparkles,
      },
      {
        label: 'الظاهرة اللغوية',
        keywords: ['الظاهرة اللغوية', 'لغوية', 'قواعد', 'language', 'نحو', 'بلاغة'],
        to: '/important-content',
        hash: 'social-economic--language',
        icon: Sparkles,
      },
      {
        label: 'الإنتاج الكتابي',
        keywords: ['الإنتاج الكتابي', 'كتابي', 'كتابة', 'writing', 'عائشة', 'انتاج', 'سرد'],
        to: '/important-content',
        hash: 'social-economic--writing',
        icon: Sparkles,
      },
      { label: 'المجموعات', keywords: ['المجموعات', 'مجموعة', 'groups', 'مشروع'], to: '/groups', icon: Users },
      { label: 'تقويم الوحدة', keywords: ['تقويم الوحدة', 'تقويم', 'exercises', 'تمرين', 'وحدة'], to: '/exercises', icon: FileText },
      { label: 'إبداعات التلاميذ', keywords: ['إبداعات التلاميذ', 'إبداعات', 'resources', 'إبداع'], to: '/resources', icon: Palette },
      { label: 'المكتبة الرقمية', keywords: ['المكتبة الرقمية', 'مكتبة', 'lectures', 'محاضرات', 'درس'], to: '/lectures', icon: FileText },
      { label: 'المحادثة', keywords: ['المحادثة', 'محادثة', 'chat', 'رسائل'], to: '/chat', icon: MessageCircle },
      { label: 'أبواب القصر', keywords: ['أبواب القصر', 'أبواب', 'قصر', 'quizzes', 'quiz', 'لعبة', 'الدهليز'], to: '/quizzes', icon: HelpCircle },
      { label: 'تواصل', keywords: ['تواصل', 'tawasol', 'contact'], to: '/chat', icon: MessageCircle },
    ]
    if (user?.role === 'admin') {
      items.push({ label: 'التحكم عن بعد', keywords: ['التحكم عن بعد', 'admin', 'أدمن', 'تحكم'], to: '/admin', icon: Radio })
    }
    return items
  }, [user?.role])

  useEffect(() => {
    if (!searchFeedback) return
    const timer = window.setTimeout(() => setSearchFeedback(''), 3200)
    return () => window.clearTimeout(timer)
  }, [searchFeedback])

  const handleSearch = () => {
    const normalized = searchValue.trim().toLowerCase()
    if (!normalized) return

    const ranked = quickLinks
      .map((item) => ({ item, score: scoreQuickLink(item, normalized) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)

    const match = ranked[0]?.item
    if (match) {
      navigate({ to: match.to, hash: match.hash })
      setSearchValue('')
      setSearchFeedback('')
      return
    }

    setSearchFeedback('لم نجد صفحة مطابقة. جرّب: أبواب القصر، فهم المقروء، الإنتاج الكتابي، المجموعات...')
  }

  return (
      <AuthContext.Provider value={authValue}>
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
          {!hideMainHeader ? (
            <header ref={headerRef} className="sticky top-0 z-50 w-full space-y-0 bg-background/95 py-0 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/90" dir="rtl">
              <div className="w-full">
                <div className={`topbar-primary flex min-h-[34px] flex-wrap items-center justify-between gap-2 rounded-none border-0 px-3 py-0.5 shadow-[0_8px_22px_rgba(15,118,110,0.18)] ${user ? 'max-md:hidden' : ''}`}>
                  <Link to={user ? '/home' : '/'} className="group flex items-center gap-3" aria-label="شعار الكلية">
                    <div className="flex h-7 w-20 items-center justify-center overflow-hidden bg-transparent px-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 sm:w-28">
                      <img src="/branding/university-fpd-logo.jpeg" alt="شعار الكلية" className="university-logo-clean h-full w-full object-contain" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-white sm:text-xs">الكلية متعددة التخصصات بالراشدية</p>
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-wrap items-center justify-start gap-2 sm:flex-nowrap lg:flex-none">
                    {!user ? (
                      <div className="flex items-center gap-2">
                        {!isLoading && (
                          <>
                            <Button variant="ghost" asChild>
                              <Link to="/login">تسجيل الدخول</Link>
                            </Button>
                            <Button asChild>
                              <Link to="/register">إنشاء حساب</Link>
                            </Button>
                          </>
                        )}
                      </div>
                    ) : <div />}
                  </div>
                </div>
              </div>

              {user ? (
                <div className="w-full">
                  <div className="platform-art-bar flex min-h-[50px] items-center justify-between gap-2 rounded-none border-0 px-3 py-0.5 shadow-[0_8px_20px_rgba(120,75,12,0.08)]">
                    <Link to="/home" className="group flex min-w-0 items-center gap-3" aria-label="منصة نخلة">
                      <div className="flex h-12 w-32 items-center justify-center overflow-hidden bg-transparent px-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 sm:h-14 sm:w-40">
                        <img src="/branding/nakhla-full-logo.png" alt="منصة نخلة" className="h-full w-full object-contain" />
                      </div>
                      <span className="hidden px-1 py-0.5 text-base font-black text-emerald-800 sm:inline-flex sm:text-xl">لتعلّم اللغة العربية</span>
                    </Link>

                    <div className="flex min-w-0 flex-1 shrink items-center justify-end gap-1.5 sm:shrink-0 sm:flex-none">
                      <div className="relative min-w-0 flex-1 sm:w-[170px] sm:flex-none md:w-[220px]">
                        <button
                          type="button"
                          onClick={handleSearch}
                          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-emerald-800 transition hover:bg-emerald-100 sm:h-6 sm:w-6"
                          aria-label="بحث"
                        >
                          <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </button>
                        <Input
                          value={searchValue}
                          onChange={(e) => {
                            setSearchValue(e.target.value)
                            if (searchFeedback) setSearchFeedback('')
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleSearch()
                            }
                          }}
                          className="h-9 rounded-lg border-emerald-200 bg-white/95 pr-9 text-right text-sm shadow-inner focus-visible:ring-emerald-300 sm:h-7 sm:pr-8 sm:text-xs"
                          placeholder="بحث..."
                          aria-describedby={searchFeedback ? 'search-feedback' : undefined}
                        />
                        {searchFeedback ? (
                          <p
                            id="search-feedback"
                            role="status"
                            className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-900 shadow-sm"
                          >
                            {searchFeedback}
                          </p>
                        ) : null}
                      </div>
                      <Button variant="ghost" asChild className="hidden min-h-9 rounded-lg px-2 text-xs font-black text-emerald-950 hover:bg-white/70 sm:inline-flex sm:h-8 sm:px-3">
                        <Link to="/home">الرئيسية</Link>
                      </Button>
                      <Button variant="ghost" onClick={scrollToFooter} className="hidden min-h-9 rounded-lg px-2 text-xs font-black text-emerald-950 hover:bg-white/70 sm:inline-flex sm:h-8 sm:px-3">
                        تواصل
                      </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="profile-menu-trigger min-h-9 rounded-lg border-emerald-300/80 bg-white/95 px-2.5 text-emerald-950 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-gradient-to-l hover:from-emerald-50 hover:to-cyan-50 hover:text-emerald-900 hover:shadow-lg hover:shadow-emerald-500/25 hover:ring-2 hover:ring-emerald-200/80 sm:h-8">
                          {user.profilePhotoUrl ? (
                            <img src={user.profilePhotoUrl} alt={user.fullName || user.email} className="ml-2 h-7 w-7 rounded-full object-cover ring-2 ring-white" />
                          ) : (
                            <span className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-800 ring-2 ring-white">
                              {(user.fullName || user.email).slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="max-w-[150px] truncate text-xs font-black">{user.fullName || user.email.split('@')[0]}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={openProfile}>
                          <UserIcon className="ml-2 h-4 w-4" />
                          تعديل الملف الشخصي
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout} className="text-destructive">
                          <LogOut className="ml-2 h-4 w-4" />
                          تسجيل الخروج
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                </div>
              ) : null}
            </header>
          ) : null}

          <main className={hideMainHeader ? 'w-full px-2 py-3 md:px-3 md:py-4' : 'w-full px-0 py-0'}>
            <Outlet />
          </main>

          {!hideMainHeader && user ? (
            <footer className="mt-5 bg-[#0b8540] text-white" dir="rtl">
            <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-3 px-4 py-2 sm:px-6 lg:px-8">
          
              {/* Top */}
              <div className="flex items-center justify-between">
          
                {/* Logo + Title */}
                <div className="ml-auto flex items-center gap-3 text-right">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/25">
                    <img
                      src="/branding/platform-logo.png"
                      alt="منصة نخلة"
                      className="h-10 w-10 object-contain"
                    />
                  </div>
          
                  <div>
                    <p className="whitespace-nowrap text-base font-extrabold">
                      منصة نخلة لتعلّم اللغة العربية
                    </p>
                  </div>
                </div>
          
                {/* Contact */}
                <div className="space-y-1 text-left" dir="ltr">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>Profarabealaoui@gmail.com</span>
                    <Mail className="h-4 w-4" />
                  </div>
          
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span>+212 672904080</span>
                    <Phone className="h-4 w-4" />
                  </div>
                </div>
          
              </div>
          
              {/* Bottom */}
              <div className="flex items-center justify-between" dir="rtl">

  {/* Copyright */}
  <div className="text-right text-xs font-bold leading-6 md:text-sm">
    <p>حقوق النشر © 2026 منصة نخلة لتعلّم اللغة العربية</p>
    <p>مدعوم من بنية البحث: مختبر العلوم الإنسانية والرقمنة</p>
  </div>

  {/* Social */}
  <div className="flex items-center gap-2 text-base font-black">
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">in</span>
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">▶</span>
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">◎</span>
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">𝕏</span>
    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">f</span>
  </div>

</div>
          
            </div>
          </footer>
          ) : null}
        </div>

        <NotificationCenter user={user} />

        {user ? (
          <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
            <DialogContent dir="rtl" className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>تعديل الملف الشخصي</DialogTitle>
                <DialogDescription>يمكنك تغيير الاسم الكامل وصورة الحساب.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {profileError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{profileError}</div>}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-bold text-primary ring-4 ring-primary/10">
                    {profileFile ? (
                      <img src={URL.createObjectURL(profileFile)} alt="profile preview" className="h-full w-full object-cover" />
                    ) : user.profilePhotoUrl ? (
                      <img src={user.profilePhotoUrl} alt={user.fullName} className="h-full w-full object-cover" />
                    ) : (
                      (user.fullName || user.email).slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <input ref={profileFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)} />
                  <Button type="button" variant="outline" onClick={() => profileFileRef.current?.click()} className="gap-2">
                    <Camera className="h-4 w-4" /> اختيار صورة
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profileName">الاسم الكامل</Label>
                  <Input id="profileName" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="الاسم الكامل" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={saveProfile} disabled={profileSaving} className="gap-2">
                  {profileSaving ? <Save className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                  حفظ التعديلات
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </AuthContext.Provider>
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
