import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Exercise, Homework, Lecture, Quiz, User } from '@teaching-app/shared'
import { useAuth } from './__root'
import { api } from '@/lib/api'
import { AdminSectionBoard } from '@/components/admin-section-board'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, BookOpen, ClipboardList, FileText, Loader2, Users } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/tracking')({
  component: TrackingPage,
})

function TrackingPage() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth()
  const [loadingData, setLoadingData] = useState(true)
  const [counts, setCounts] = useState({ lectures: 0, exercises: 0, quizzes: 0, homework: 0, users: 0 })

  useEffect(() => {
    if (isLoading) return
    if (!isAdmin) {
      setLoadingData(false)
      return
    }
    Promise.all([
      api.get<{ lectures: Lecture[] }>('/lectures'),
      api.get<{ exercises: Exercise[] }>('/exercises'),
      api.get<{ quizzes: Quiz[] }>('/quizzes'),
      api.get<{ homework: Homework[] }>('/homework'),
      api.get<{ users: User[] }>('/admin/users'),
    ]).then(([lectures, exercises, quizzes, homework, users]) => {
      setCounts({
        lectures: lectures.lectures.length,
        exercises: exercises.exercises.length,
        quizzes: quizzes.quizzes.length,
        homework: homework.homework.length,
        users: users.users.length,
      })
    }).catch((err) => console.error('Failed to load tracking data:', err)).finally(() => setLoadingData(false))
  }, [isAdmin, isLoading])

  if (isLoading || loadingData) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!isAuthenticated) return <Navigate to="/login" />
  if (!isAdmin) return <Navigate to="/home" />

  const cards = [
    ['المكتبة الرقمية', counts.lectures, BookOpen],
    ['تقويم الوحدة', counts.exercises, FileText],
    ['أبواب القصر', counts.quizzes, BarChart3],
    ['مشاريع المجموعات', counts.homework, ClipboardList],
    ['الحسابات', counts.users, Users],
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">التتبع</h1>
        <p className="text-muted-foreground">لوحة سريعة لمتابعة حجم المحتوى والحسابات.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([title, value, Icon]) => (
          <Card key={title}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <div className="text-sm text-muted-foreground">{title}</div>
                <div className="mt-1 text-3xl font-bold">{value}</div>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>ملخص سريع</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>يمكن للمشرف من هنا تتبع حجم المحتوى الموجود داخل المنصة.</p>
          <p>استخدم صفحة إدارة الحسابات لتعديل الأدوار، وصفحة التلاميذ لمراجعة قائمة الطلاب.</p>
          <p>مشاريع المجموعات أصبحت داخل صفحة المجموعات ليستعملها المستخدمون مع محادثات المجموعة.</p>
        </CardContent>
      </Card>

      <AdminSectionBoard section="tracking" title="رفع ملفات وملاحظات التتبع" />    </div>
  )
}
