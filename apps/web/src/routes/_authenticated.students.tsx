import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { User } from '@teaching-app/shared'
import { useAuth } from './__root'
import { api } from '@/lib/api'
import { AdminSectionBoard } from '@/components/admin-section-board'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { GraduationCap, Loader2, Search } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/students')({
  component: StudentsPage,
})

function StudentsPage() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!isAdmin) {
      setLoadingUsers(false)
      return
    }
    api.get<{ users: User[] }>('/admin/users')
      .then(({ users }) => setUsers(users.filter((user) => user.role === 'user')))
      .catch((err) => console.error('Failed to load students:', err))
      .finally(() => setLoadingUsers(false))
  }, [isAdmin, isLoading])

  if (isLoading || loadingUsers) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  if (!isAuthenticated) return <Navigate to="/login" />
  if (!isAdmin) return <Navigate to="/home" />

  const filtered = users.filter((user) => `${user.fullName || ''} ${user.email}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">التلاميذ</h1>
        <p className="text-muted-foreground">قائمة التلاميذ المتوفرين في النظام.</p>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input className="pr-10" placeholder="ابحث بالاسم أو البريد الإلكتروني" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>عدد التلاميذ: {filtered.length}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((user) => (
            <div key={user.id} className="rounded-lg border p-4">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><GraduationCap className="h-5 w-5" /></div>
              <div className="font-medium">{user.fullName || user.email}</div><div className="text-xs text-muted-foreground">{user.email}</div>
              <div className="text-sm text-muted-foreground">تاريخ الإضافة: {new Date(user.createdAt).toLocaleDateString('ar-MA')}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AdminSectionBoard section="students" title="رفع ملفات وملاحظات التلاميذ" />    </div>
  )
}
