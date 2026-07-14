import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { User, UsersListResponse } from '@teaching-app/shared'

const users = new Hono()

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

  const usersList: User[] = dbUsers.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name || u.email.split('@')[0],
    role: u.role as 'user' | 'admin',
    status: u.status as User['status'],
    emailVerified: Boolean(u.email_verified),
    profilePhotoUrl: u.profile_photo_url ?? null,
    createdAt: u.created_at,
  }))

  return c.json<UsersListResponse>({ users: usersList })
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
