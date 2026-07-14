import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import bcrypt from 'bcrypt'
import { db } from '../db/index.js'
import {
  createAccessToken,
  createRefreshToken,
  verifyToken,
  getRefreshTokenExpiry,
} from '../lib/jwt.js'
import { authMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { LoginRequest, RegisterRequest, AuthResponse, User } from '@teaching-app/shared'

const auth = new Hono()

const SALT_ROUNDS = 12
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface DbUser {
  id: number
  email: string
  full_name: string
  password_hash: string
  role: string
  status: string
  email_verified: number
  profile_photo_url: string | null
  created_at: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function mapDbUser(dbUser: Omit<DbUser, 'password_hash'>): User {
  return {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name || dbUser.email.split('@')[0],
    role: dbUser.role as 'user' | 'admin',
    status: dbUser.status as User['status'],
    emailVerified: Boolean(dbUser.email_verified),
    profilePhotoUrl: dbUser.profile_photo_url ?? null,
    createdAt: dbUser.created_at,
  }
}

auth.post('/register', async (c) => {
  const body = await c.req.json<RegisterRequest>()
  const fullName = body.fullName?.trim() || ''
  const email = normalizeEmail(body.email || '')
  const password = body.password || ''

  if (!fullName || !email || !password) {
    return c.json({ error: 'Bad Request', message: 'Full name, email and password are required' }, 400)
  }

  if (!EMAIL_PATTERN.test(email)) {
    return c.json({ error: 'Bad Request', message: 'البريد الإلكتروني غير صالح' }, 400)
  }

  if (password.length < 8) {
    return c.json({ error: 'Bad Request', message: 'Password must be at least 8 characters' }, 400)
  }

  const existingUser = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email) as DbUser | undefined

  if (existingUser) {
    return c.json({ error: 'Conflict', message: 'Email already registered' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const result = db
    .prepare("INSERT INTO users (email, full_name, password_hash, status) VALUES (?, ?, ?, 'pending')")
    .run(email, fullName, passwordHash)

  const userId = Number(result.lastInsertRowid)

  wsManager.broadcast({
    type: 'registration:requested',
    data: { userId, email, userEmail: email, userFullName: fullName },
  })

  return c.json(
    {
      pending: true,
      message: 'تم إنشاء حسابك. يرجى انتظار موافقة الإدارة على طلبك.',
    },
    201,
  )
})

auth.post('/login', async (c) => {
  const body = await c.req.json<LoginRequest>()
  const email = normalizeEmail(body.email || '')
  const password = body.password || ''

  if (!email || !password) {
    return c.json({ error: 'Bad Request', message: 'Email and password are required' }, 400)
  }

  const dbUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined

  if (!dbUser) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password' }, 401)
  }

  const validPassword = await bcrypt.compare(password, dbUser.password_hash)

  if (!validPassword) {
    return c.json({ error: 'Unauthorized', message: 'Invalid email or password' }, 401)
  }

  if (dbUser.status === 'pending') {
    return c.json(
      { error: 'Forbidden', message: 'حسابك قيد المراجعة من طرف الإدارة. يرجى الانتظار حتى تتم الموافقة.' },
      403,
    )
  }

  if (dbUser.status === 'rejected') {
    return c.json(
      { error: 'Forbidden', message: 'تم رفض طلب تسجيلك. يرجى التواصل مع الإدارة.' },
      403,
    )
  }

  const user = mapDbUser(dbUser)

  const tokenPayload = { userId: dbUser.id, email: dbUser.email, role: dbUser.role }
  const accessToken = await createAccessToken(tokenPayload)
  const refreshToken = await createRefreshToken(tokenPayload)

  const refreshExpiry = getRefreshTokenExpiry()
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    dbUser.id,
    refreshToken,
    refreshExpiry.toISOString(),
  )

  setCookie(c, 'access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 15 * 60,
    path: '/',
  })

  setCookie(c, 'refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return c.json({ user, accessToken, refreshToken, message: 'Login successful' } satisfies AuthResponse & {
    accessToken: string
    refreshToken: string
  })
})

auth.patch('/profile', authMiddleware, async (c) => {
  const tokenUser = c.get('user')
  const body = await c.req.json<{ fullName?: string; profilePhotoUrl?: string | null }>()
  const fullName = body.fullName?.trim()
  const profilePhotoUrl = body.profilePhotoUrl === undefined ? undefined : (body.profilePhotoUrl?.trim() || null)

  if (fullName !== undefined && fullName.length < 2) {
    return c.json({ error: 'Bad Request', message: 'Full name must be at least 2 characters' }, 400)
  }

  if (fullName !== undefined && profilePhotoUrl !== undefined) {
    db.prepare('UPDATE users SET full_name = ?, profile_photo_url = ? WHERE id = ?').run(fullName, profilePhotoUrl, tokenUser.userId)
  } else if (fullName !== undefined) {
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName, tokenUser.userId)
  } else if (profilePhotoUrl !== undefined) {
    db.prepare('UPDATE users SET profile_photo_url = ? WHERE id = ?').run(profilePhotoUrl, tokenUser.userId)
  }

  const dbUser = db
    .prepare('SELECT id, email, full_name, role, status, email_verified, profile_photo_url, created_at FROM users WHERE id = ?')
    .get(tokenUser.userId) as Omit<DbUser, 'password_hash'> | undefined

  if (!dbUser) {
    return c.json({ error: 'Not Found', message: 'User not found' }, 404)
  }

  return c.json({ user: mapDbUser(dbUser), message: 'Profile updated successfully' })
})

auth.post('/logout', async (c) => {
  const refreshToken = getCookie(c, 'refresh_token')

  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken)
  }

  deleteCookie(c, 'access_token', { path: '/' })
  deleteCookie(c, 'refresh_token', { path: '/' })

  return c.json({ message: 'Logged out successfully' })
})

auth.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refresh_token')

  if (!refreshToken) {
    return c.json({ error: 'Unauthorized', message: 'No refresh token provided' }, 401)
  }

  const payload = await verifyToken(refreshToken)

  if (!payload) {
    deleteCookie(c, 'access_token', { path: '/' })
    deleteCookie(c, 'refresh_token', { path: '/' })
    return c.json({ error: 'Unauthorized', message: 'Invalid refresh token' }, 401)
  }

  const storedToken = db
    .prepare("SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime('now')")
    .get(refreshToken)

  if (!storedToken) {
    deleteCookie(c, 'access_token', { path: '/' })
    deleteCookie(c, 'refresh_token', { path: '/' })
    return c.json({ error: 'Unauthorized', message: 'Refresh token expired or revoked' }, 401)
  }

  const accessToken = await createAccessToken(payload)

  setCookie(c, 'access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 15 * 60,
    path: '/',
  })

  return c.json({ message: 'Token refreshed successfully' })
})

auth.get('/me', authMiddleware, async (c) => {
  const tokenUser = c.get('user')

  const dbUser = db
    .prepare('SELECT id, email, full_name, role, status, email_verified, profile_photo_url, created_at FROM users WHERE id = ?')
    .get(tokenUser.userId) as Omit<DbUser, 'password_hash'> | undefined

  if (!dbUser) {
    return c.json({ error: 'Not Found', message: 'User not found' }, 404)
  }

  return c.json({ user: mapDbUser(dbUser) })
})

export { auth }