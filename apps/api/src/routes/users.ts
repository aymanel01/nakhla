import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { User, UsersListResponse, PasswordResetRequestsResponse, PasswordResetRequest, CreateUserResponse } from '@teaching-app/shared'
import bcrypt from 'bcrypt'

const users = new Hono()
const SALT_ROUNDS = 12
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function mapDbUser(u: DbUser): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name || u.email.split('@')[0],
    role: u.role as 'user' | 'admin',
    status: u.status as User['status'],
    emailVerified: Boolean(u.email_verified),
    profilePhotoUrl: u.profile_photo_url ?? null,
    createdAt: u.created_at,
  }
}

users.use('*', authMiddleware, adminMiddleware)

interface DbUser {
  id: number
  email: string
  full_name: string
  role: string
  status: string
  email_verified: number
  profile_photo_url: string | null
  created_at: string
}

users.get('/', async (c) => {
  const dbUsers = db
    .prepare('SELECT id, email, full_name, role, status, email_verified, profile_photo_url, created_at FROM users ORDER BY created_at DESC')
    .all() as DbUser[]

  const usersList: User[] = dbUsers.map((u) => mapDbUser(u))

  return c.json<UsersListResponse>({ users: usersList })
})

users.post('/', async (c) => {
  const body = await c.req.json<{ fullName?: string; email?: string; password?: string; role?: string }>()
  const fullName = body.fullName?.trim() || ''
  const email = normalizeEmail(body.email || '')
  const password = body.password || ''
  const role = body.role === 'admin' ? 'admin' : 'user'

  if (!fullName || !email || !password) {
    return c.json({ error: 'Bad Request', message: 'Full name, email and password are required' }, 400)
  }

  if (!EMAIL_PATTERN.test(email)) {
    return c.json({ error: 'Bad Request', message: 'البريد الإلكتروني غير صالح' }, 400)
  }

  if (password.length < 8) {
    return c.json({ error: 'Bad Request', message: 'Password must be at least 8 characters' }, 400)
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existingUser) {
    return c.json({ error: 'Conflict', message: 'البريد الإلكتروني مستخدم بالفعل' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const result = db.prepare(`
    INSERT INTO users (email, full_name, password_hash, role, status, email_verified)
    VALUES (?, ?, ?, ?, 'approved', 1)
  `).run(email, fullName, passwordHash, role)

  const userId = Number(result.lastInsertRowid)
  const dbUser = db.prepare(`
    SELECT id, email, full_name, role, status, email_verified, profile_photo_url, created_at
    FROM users WHERE id = ?
  `).get(userId) as DbUser

  return c.json<CreateUserResponse>({
    user: mapDbUser(dbUser),
    message: 'تم إنشاء الحساب بنجاح',
  }, 201)
})

function revokeUserSessions(userId: number) {
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId)
}

function resolvePasswordResetRequests(userId: number, adminId: number) {
  db.prepare(`
    UPDATE password_reset_requests
    SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
    WHERE user_id = ? AND status = 'pending'
  `).run(adminId, userId)
}

users.get('/password-resets', async (c) => {
  const rows = db.prepare(`
    SELECT r.id, r.user_id, r.status, r.created_at, r.resolved_at,
           u.email, u.full_name
    FROM password_reset_requests r
    JOIN users u ON u.id = r.user_id
    WHERE r.status = 'pending'
    ORDER BY r.created_at DESC
  `).all() as {
    id: number
    user_id: number
    status: string
    created_at: string
    resolved_at: string | null
    email: string
    full_name: string
  }[]

  const requests: PasswordResetRequest[] = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userEmail: row.email,
    userFullName: row.full_name || row.email.split('@')[0],
    status: row.status as PasswordResetRequest['status'],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }))

  return c.json<PasswordResetRequestsResponse>({ requests })
})

users.patch('/password-resets/:requestId/dismiss', async (c) => {
  const requestId = Number.parseInt(c.req.param('requestId'), 10)
  const result = db.prepare(`
    UPDATE password_reset_requests
    SET status = 'dismissed', resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
    WHERE id = ? AND status = 'pending'
  `).run(c.get('user').userId, requestId)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Password reset request not found' }, 404)
  }

  return c.json({ message: 'تم تجاهل الطلب' })
})

users.patch('/:id/password', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const { newPassword } = await c.req.json<{ newPassword?: string }>()

  if (!newPassword || newPassword.length < 8) {
    return c.json({ error: 'Bad Request', message: 'Password must be at least 8 characters' }, 400)
  }

  const dbUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
  if (!dbUser) {
    return c.json({ error: 'Not Found', message: 'User not found' }, 404)
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
  revokeUserSessions(id)
  resolvePasswordResetRequests(id, c.get('user').userId)

  return c.json({ message: 'تم تعيين كلمة المرور الجديدة بنجاح' })
})

users.patch('/:id/status', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const { status } = await c.req.json<{ status: string }>()

  if (status !== 'approved' && status !== 'rejected') {
    return c.json({ error: 'Bad Request', message: 'Status must be "approved" or "rejected"' }, 400)
  }

  const result = db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'User not found' }, 404)
  }

  wsManager.broadcast({ type: 'registration:reviewed', data: { userId: id, status } })

  return c.json({ message: 'User status updated successfully' })
})

users.patch('/:id/role', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const { role } = await c.req.json<{ role: string }>()

  if (role !== 'user' && role !== 'admin') {
    return c.json({ error: 'Bad Request', message: 'Role must be "user" or "admin"' }, 400)
  }

  const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'User not found' }, 404)
  }

  return c.json({ message: 'User role updated successfully' })
})

users.delete('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const currentUser = c.get('user')

  if (currentUser.userId === id) {
    return c.json({ error: 'Bad Request', message: 'Cannot delete your own account' }, 400)
  }

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'User not found' }, 404)
  }

  return c.json({ message: 'User deleted successfully' })
})

export { users }
