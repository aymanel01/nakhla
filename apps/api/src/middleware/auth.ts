import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { verifyToken, type TokenPayload } from '../lib/jwt.js'

declare module 'hono' {
  interface ContextVariableMap {
    user: TokenPayload
  }
}

export async function authMiddleware(c: Context, next: Next) {
  // Try cookie first (web), then Authorization header (mobile)
  let accessToken = getCookie(c, 'access_token')

  if (!accessToken) {
    const authHeader = c.req.header('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      accessToken = authHeader.slice(7)
    }
  }

  if (!accessToken) {
    return c.json({ error: 'Unauthorized', message: 'No access token provided' }, 401)
  }

  const payload = await verifyToken(accessToken)

  if (!payload) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401)
  }

  c.set('user', payload)
  await next()
}

export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403)
  }

  await next()
}
