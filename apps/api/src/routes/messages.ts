import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { ChatSettings, Message } from '@teaching-app/shared'

const messages = new Hono()

interface DbMessage {
  id: number
  user_id: number
  content: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
  user_email: string
}

function mapMessage(row: DbMessage): Message {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    content: row.content,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }
}


function getChatSettings(): ChatSettings {
  const row = db.prepare('SELECT users_can_send FROM chat_settings WHERE id = 1').get() as { users_can_send: number } | undefined
  return { usersCanSend: Boolean(row?.users_can_send) }
}

messages.get('/settings', authMiddleware, (c) => {
  return c.json({ settings: getChatSettings() })
})

messages.patch('/settings', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<{ usersCanSend?: boolean }>()
  const usersCanSend = body.usersCanSend ? 1 : 0
  db.prepare('UPDATE chat_settings SET users_can_send = ? WHERE id = 1').run(usersCanSend)
  wsManager.broadcast({ type: 'chat:settings', data: { usersCanSend: Boolean(usersCanSend) } })
  return c.json({ settings: { usersCanSend: Boolean(usersCanSend) } })
})

messages.get('/', authMiddleware, async (c) => {
  const limit = Number.parseInt(c.req.query('limit') || '50', 10)
  const before = c.req.query('before')

  let query = `
    SELECT m.*, u.email as user_email
    FROM messages m
    JOIN users u ON m.user_id = u.id
  `

  const params: (number | string)[] = []

  if (before) {
    query += ' WHERE m.id < ?'
    params.push(Number.parseInt(before, 10))
  }

  query += ' ORDER BY m.created_at DESC LIMIT ?'
  params.push(limit)

  const rows = db.prepare(query).all(...params) as DbMessage[]
  return c.json({ messages: rows.map(mapMessage).reverse() })
})

messages.post('/', authMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ content?: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number }>()
  const settings = getChatSettings()

  if (user.role !== 'admin' && !settings.usersCanSend) {
    return c.json({ error: 'Forbidden', message: 'Chat is closed by admin' }, 403)
  }

  const content = body.content?.trim() || ''
  const hasFile = Boolean(body.fileUrl?.trim())

  if (!content && !hasFile) {
    return c.json({ error: 'Bad Request', message: 'Content or file is required' }, 400)
  }

  const result = db.prepare(`
    INSERT INTO messages (user_id, content, file_url, file_name, file_type, file_size)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    user.userId,
    content,
    body.fileUrl?.trim() || null,
    body.fileName?.trim() || null,
    body.fileType?.trim() || null,
    body.fileSize ?? null,
  )

  const row = db.prepare(`
    SELECT m.*, u.email as user_email
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid) as DbMessage

  const message = mapMessage(row)
  wsManager.broadcast({ type: 'chat:message', data: message })

  return c.json({ message, success: true }, 201)
})

messages.delete('/:id', authMiddleware, (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')

  const existing = db.prepare('SELECT user_id FROM messages WHERE id = ?').get(id) as { user_id: number } | undefined
  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Message not found' }, 404)
  }

  if (user.role !== 'admin' && existing.user_id !== user.userId) {
    return c.json({ error: 'Forbidden', message: 'You can delete only your own messages' }, 403)
  }

  db.prepare('DELETE FROM messages WHERE id = ?').run(id)
  wsManager.broadcast({ type: 'chat:deleted', data: { id } })

  return c.json({ success: true, message: 'Message deleted successfully' })
})

export { messages }
