import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { Group, GroupMessage, User } from '@teaching-app/shared'

const groups = new Hono()

interface DbGroupRow {
  id: number
  name: string
  description: string | null
  grade: string | null
  created_by: number
  created_at: string
  member_count?: number
}

interface DbMessageRow {
  id: number
  group_id: number
  user_id: number
  content: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
  user_email: string
}

interface DbUserRow {
  id: number
  email: string
  full_name: string
  role: string
  status: string
  email_verified: number
  created_at: string
  profile_photo_url?: string | null
}

function mapGroup(row: DbGroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    grade: row.grade,
    createdBy: row.created_by,
    memberCount: row.member_count ?? 0,
    createdAt: row.created_at,
  }
}

function mapGroupMessage(row: DbMessageRow): GroupMessage {
  return {
    id: row.id,
    groupId: row.group_id,
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

function ensureMembership(groupId: number, userId: number) {
  return db
    .prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?')
    .get(groupId, userId)
}

function canOpenGroup(groupId: number, user: { userId: number; role: string }) {
  return user.role === 'admin' || Boolean(ensureMembership(groupId, user.userId))
}

function usersCanSendChat() {
  const settings = db.prepare('SELECT users_can_send FROM chat_settings WHERE id = 1').get() as { users_can_send: number } | undefined
  return Boolean(settings?.users_can_send)
}

groups.use('*', authMiddleware)

groups.get('/', async (c) => {
  const user = c.get('user')

  const rows = user.role === 'admin'
    ? db
        .prepare(`
          SELECT g.*, COUNT(gm.user_id) as member_count
          FROM project_groups g
          LEFT JOIN group_members gm ON gm.group_id = g.id
          GROUP BY g.id
          ORDER BY g.created_at DESC
        `)
        .all() as DbGroupRow[]
    : db
        .prepare(`
          SELECT g.*, COUNT(gm.user_id) as member_count
          FROM project_groups g
          LEFT JOIN group_members gm ON gm.group_id = g.id
          WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = ?)
          GROUP BY g.id
          ORDER BY g.created_at DESC
        `)
        .all(user.userId) as DbGroupRow[]

  return c.json({ groups: rows.map(mapGroup) })
})

groups.get('/users', adminMiddleware, async (c) => {
  const rows = db
    .prepare("SELECT id, email, full_name, role, status, email_verified, profile_photo_url, created_at FROM users WHERE status = 'approved' ORDER BY full_name COLLATE NOCASE ASC, email ASC")
    .all() as DbUserRow[]

  const users: User[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name || row.email.split('@')[0],
    role: row.role as 'user' | 'admin',
    status: row.status as User['status'],
    emailVerified: Boolean(row.email_verified),
    profilePhotoUrl: row.profile_photo_url ?? null,
    createdAt: row.created_at,
  }))

  return c.json({ users })
})

groups.post('/', adminMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ name?: string; description?: string; grade?: string; memberIds?: number[] }>()

  if (!body.name?.trim()) {
    return c.json({ error: 'Bad Request', message: 'Group name is required' }, 400)
  }

  const result = db
    .prepare('INSERT INTO project_groups (name, description, grade, created_by) VALUES (?, ?, ?, ?)')
    .run(body.name.trim(), body.description?.trim() || null, body.grade?.trim() || null, user.userId)

  const groupId = Number(result.lastInsertRowid)
  const memberIds = Array.from(new Set([user.userId, ...(body.memberIds || [])]))
  const insertMember = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)')

  for (const memberId of memberIds) {
    insertMember.run(groupId, memberId)
  }

  const row = db
    .prepare(`
      SELECT g.*, COUNT(gm.user_id) as member_count
      FROM project_groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id = ?
      GROUP BY g.id
    `)
    .get(groupId) as DbGroupRow

  const group = mapGroup(row)
  wsManager.broadcast({ type: 'group:created', data: group })
  return c.json({ group, success: true }, 201)
})

groups.delete('/:groupId', adminMiddleware, async (c) => {
  const groupId = Number.parseInt(c.req.param('groupId'), 10)

  const existing = db.prepare('SELECT id FROM project_groups WHERE id = ?').get(groupId)
  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  db.prepare('DELETE FROM group_messages WHERE group_id = ?').run(groupId)
  db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId)
  db.prepare('DELETE FROM project_groups WHERE id = ?').run(groupId)

  wsManager.broadcast({ type: 'group:deleted', data: { id: groupId } })

  return c.json({ success: true, message: 'Group deleted successfully' })
})

groups.get('/:groupId/members', async (c) => {
  const groupId = Number.parseInt(c.req.param('groupId'), 10)
  const user = c.get('user')

  if (!canOpenGroup(groupId, user)) {
    return c.json({ error: 'Forbidden', message: 'You are not a member of this group' }, 403)
  }

  const rows = db
    .prepare(`
      SELECT u.id, u.email, u.full_name, u.role, u.status, u.profile_photo_url, u.created_at
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY u.full_name COLLATE NOCASE ASC, u.email ASC
    `)
    .all(groupId) as DbUserRow[]

  const members: User[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name || row.email.split('@')[0],
    role: row.role as 'user' | 'admin',
    status: row.status as User['status'],
    profilePhotoUrl: row.profile_photo_url ?? null,
    createdAt: row.created_at,
  }))

  return c.json({ members })
})

groups.post('/:groupId/members', adminMiddleware, async (c) => {
  const groupId = Number.parseInt(c.req.param('groupId'), 10)
  const { userId } = await c.req.json<{ userId?: number }>()

  if (!userId) {
    return c.json({ error: 'Bad Request', message: 'userId is required' }, 400)
  }

  const groupExists = db.prepare('SELECT id FROM project_groups WHERE id = ?').get(groupId)
  if (!groupExists) {
    return c.json({ error: 'Not Found', message: 'Group not found' }, 404)
  }

  db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId)
  return c.json({ success: true, message: 'Member added successfully' })
})

groups.delete('/:groupId/members/:userId', adminMiddleware, async (c) => {
  const groupId = Number.parseInt(c.req.param('groupId'), 10)
  const userId = Number.parseInt(c.req.param('userId'), 10)

  const result = db
    .prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?')
    .run(groupId, userId)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Member not found in this group' }, 404)
  }

  return c.json({ success: true, message: 'Member removed successfully' })
})

groups.get('/:groupId/messages', async (c) => {
  const groupId = Number.parseInt(c.req.param('groupId'), 10)
  const user = c.get('user')

  if (!canOpenGroup(groupId, user)) {
    return c.json({ error: 'Forbidden', message: 'You are not a member of this group' }, 403)
  }

  const rows = db
    .prepare(`
      SELECT gm.*, u.email as user_email
      FROM group_messages gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY gm.created_at ASC
    `)
    .all(groupId) as DbMessageRow[]

  return c.json({ messages: rows.map(mapGroupMessage) })
})

groups.post('/:groupId/messages', async (c) => {
  const groupId = Number.parseInt(c.req.param('groupId'), 10)
  const user = c.get('user')
  const body = await c.req.json<{ content?: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number }>()

  if (!canOpenGroup(groupId, user)) {
    return c.json({ error: 'Forbidden', message: 'You are not a member of this group' }, 403)
  }

  if (user.role !== 'admin' && !usersCanSendChat()) {
    return c.json({ error: 'Forbidden', message: 'Chat is closed by admin' }, 403)
  }

  const content = body.content?.trim() || ''
  const hasFile = Boolean(body.fileUrl?.trim())

  if (!content && !hasFile) {
    return c.json({ error: 'Bad Request', message: 'Content or file is required' }, 400)
  }

  const result = db
    .prepare('INSERT INTO group_messages (group_id, user_id, content, file_url, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(groupId, user.userId, content, body.fileUrl?.trim() || null, body.fileName?.trim() || null, body.fileType?.trim() || null, body.fileSize ?? null)

  const row = db
    .prepare(`
      SELECT gm.*, u.email as user_email
      FROM group_messages gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.id = ?
    `)
    .get(result.lastInsertRowid) as DbMessageRow

  const message = mapGroupMessage(row)
  wsManager.broadcast({ type: 'group:message', data: message })

  return c.json({ message, success: true }, 201)
})

groups.delete('/:groupId/messages/:messageId', async (c) => {
  const groupId = Number.parseInt(c.req.param('groupId'), 10)
  const messageId = Number.parseInt(c.req.param('messageId'), 10)
  const user = c.get('user')

  if (!canOpenGroup(groupId, user)) {
    return c.json({ error: 'Forbidden', message: 'You are not a member of this group' }, 403)
  }

  const existing = db
    .prepare('SELECT id, user_id FROM group_messages WHERE id = ? AND group_id = ?')
    .get(messageId, groupId) as { id: number; user_id: number } | undefined

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Message not found' }, 404)
  }

  if (user.role !== 'admin' && existing.user_id !== user.userId) {
    return c.json({ error: 'Forbidden', message: 'You can delete only your own messages' }, 403)
  }

  db.prepare('DELETE FROM group_messages WHERE id = ? AND group_id = ?').run(messageId, groupId)
  wsManager.broadcast({ type: 'group:message-deleted', data: { groupId, id: messageId } })

  return c.json({ success: true, message: 'Message deleted successfully' })
})

export { groups }
