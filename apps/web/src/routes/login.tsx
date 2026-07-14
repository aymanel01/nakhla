import { createFileRoute, Link, useNavigate, Navigate } from '@tanstack/react-router'
import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from './__root'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, GraduationCap, Home } from 'lucide-react'
import type { AdminSectionPost } from '@teaching-app/shared'
import { api } from '@/lib/api'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [featuresVideoPost, setFeaturesVideoPost] = useState<AdminSectionPost | null>(null)

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: '/welcome' })
    }
  }, [isAuthenticated, authLoading, navigate])


  useEffect(() => {
    let alive = true
    api
      .get<{ posts: AdminSectionPost[] }>(`/admin/content/social-economic?category=${encodeURIComponent('tutorial:features')}`)
      .then(({ posts }) => {
        if (alive) setFeaturesVideoPost(posts.find((post) => post.fileUrl || post.content) || null)
      })
      .catch(() => {
        if (alive) setFeaturesVideoPost(null)
      })
    return () => {
      alive = false
    }
  }, [])

  const featuresVideoUrl = featuresVideoPost?.fileUrl || featuresVideoPost?.content || '/platform-intro.mp4'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate({ to: '/welcome' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الدخول'
      setError(message)
      setShowResend(message.includes('تفعيل'))
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/welcome" />
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-4 py-8" dir="rtl">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="order-2 w-full max-w-md justify-self-center rounded-[28px] border-emerald-100 bg-white/95 shadow-[0_20px_70px_rgba(15,23,42,0.12)] lg:order-1 lg:justify-self-end lg:translate-x-8">
          <Link
            to="/"
            className="absolute top-4 left-4 rounded-lg p-2 transition-colors hover:bg-muted"
            title="الصفحة اكتشف منصتي"
          >
            <Home className="h-5 w-5" />
          </Link>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <GraduationCap className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">تسجيل الدخول</CardTitle>
            <CardDescription>أدخل بياناتك للوصول إلى حسابك</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                />
              </div>
              {showResend ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-right text-sm">
                  <p className="mb-2 font-semibold text-amber-900">لم تفعّل بريدك بعد؟</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={resendLoading || !email.trim()}
                    onClick={async () => {
                      setResendLoading(true)
                      setResendMessage('')
                      try {
                        const response = await api.post<{ message: string }>(
                          '/auth/resend-verification',
                          { email: email.trim() },
                          { skipAuth: true },
                        )
                        setResendMessage(response.message)
                      } catch (err) {
                        setResendMessage(err instanceof Error ? err.message : 'تعذر إرسال رسالة التفعيل.')
                      } finally {
                        setResendLoading(false)
                      }
                    }}
                  >
                    {resendLoading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
                    إعادة إرسال رابط التفعيل
                  </Button>
                  {resendMessage ? <p className="mt-2 text-xs text-amber-800">{resendMessage}</p> : null}
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تسجيل الدخول
              </Button>
              <p className="text-sm text-muted-foreground">
                ليس لديك حساب؟{' '}
                <Link to="/register" className="text-primary hover:underline">
                  إنشاء حساب جديد
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <section className="order-1 space-y-5 rounded-[32px] border border-emerald-100 bg-white/80 p-5 text-right shadow-[0_20px_70px_rgba(15,23,42,0.10)] backdrop-blur lg:order-2">
          <h1 className="text-center text-3xl font-extrabold text-slate-950">مميزات المنصة</h1>
          <div className="mx-auto max-w-md overflow-hidden rounded-[24px] border border-emerald-100 bg-slate-950 shadow-lg">
            <video controls className="aspect-video w-full object-cover" poster="/section-images/social-economic-banner.jpg" src={featuresVideoUrl}>
              المتصفح لا يدعم تشغيل الفيديو.
            </video>
          </div>
        </section>
      </div>
    </div>
  )
}
