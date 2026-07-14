import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import type { User } from '@teaching-app/shared'
import { useAuth } from './__root'
import { api } from '@/lib/api'
import { AdminSectionBoard } from '@/components/admin-section-board'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Shield, UserCog, Users } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/accounts')({
  component: AccountsPage,
})

function AccountsPage() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  const loadUsers = async () => {
    const { users } = await api.get<{ users: User[] }>('/admin/users')
    setUsers(users)
  }

  useEffect(() => {
    if (isLoading) return
    if (!isAdmin) {
      setLoadingUsers(false)
      return
    }
    loadUsers()
      .catch((err) => console.error('Failed to load users:', err))
      .finally(() => setLoadingUsers(false))
  }, [isAdmin, isLoading])

  const toggleRole = async (target: User) => {
    await api.patch(`/admin/users/${target.id}/role`, { role: target.role === 'admin' ? 'user' : 'admin' })
    await loadUsers()
  }

  if (isLoading || loadingUsers) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }
  if (!isAuthenticated) return <Navigate to="/login" />
  if (!isAdmin) return <Navigate to="/home" />

  const admins = users.filter((user) => user.role === 'admin')
  const students = users.filter((user) => user.role === 'user')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">إدارة الحسابات</h1>
        <p className="text-muted-foreground">هذه الصفحة للمشرف فقط لإدارة أدوار المستخدمين.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="كل الحسابات" value={users.length} icon={Users} />
        <SummaryCard title="المشرفون" value={admins.length} icon={Shield} />
        <SummaryCard title="المستخدمون" value={students.length} icon={UserCog} />
      </div>
      <Card>
        <CardHeader><CardTitle>الحسابات</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium">{user.fullName || user.email}</div><div className="text-xs text-muted-foreground">{user.email}</div>
                <div className="text-sm text-muted-foreground">الدور الحالي: {user.role === 'admin' ? 'مشرف' : 'مستخدم'}</div>
              </div>
              <Button variant="outline" onClick={() => toggleRole(user)}>
                {user.role === 'admin' ? 'تحويل إلى مستخدم' : 'تحويل إلى مشرف'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AdminSectionBoard section="accounts" title="إرسال ملفات أو تنبيهات للحسابات" />    </div>
  )
}

function SummaryCard({ title, value, icon: Icon }: { title: string, value: number, icon: ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-sm text-muted-foreground">{title}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  )
}
