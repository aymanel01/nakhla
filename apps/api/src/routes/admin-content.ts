import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { AdminSection, AdminSectionPost } from '@teaching-app/shared'

const adminContent = new Hono()
const validSections = new Set<AdminSection>([
  'accounts',
  'tracking',
  'students',
  'social-economic',
])
const publicSections = new Set<AdminSection>(['social-economic'])

interface DbRow {
  id: number
  section: AdminSection
  user_id: number
  user_email: string
  content: string
  category: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
}

function mapRow(row: DbRow): AdminSectionPost {
  return {
    id: row.id,
    section: row.section,
    userId: row.user_id,
    userEmail: row.user_email,
    content: row.content,
    category: row.category,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }
}

adminContent.get('/:section', (c) => {
  const section = c.req.param('section') as AdminSection
  if (!validSections.has(section)) {
    return c.json({ error: 'Bad Request', message: 'Invalid section' }, 400)
  }

  if (!publicSections.has(section)) {
    return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403)
  }

  const category = c.req.query('category')?.trim()
  const params: string[] = [section]
  let where = 'p.section = ?'
  if (category) {
    where += ' AND p.category = ?'
    params.push(category)
  }

  const posts = db.prepare(`
    SELECT p.*, u.email AS user_email
    FROM admin_section_posts p
    JOIN users u ON u.id = p.user_id
    WHERE ${where}
    ORDER BY p.created_at DESC
  `).all(...params) as DbRow[]

  return c.json({ posts: posts.map(mapRow) })
})

adminContent.use('*', authMiddleware)

adminContent.post('/:section', adminMiddleware, async (c) => {
  const section = c.req.param('section') as AdminSection
  if (!validSections.has(section)) {
    return c.json({ error: 'Bad Request', message: 'Invalid section' }, 400)
  }

  const user = c.get('user')
  const body = await c.req.json<{ content?: string; category?: string | null; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number }>()
  const content = body.content?.trim() || ''
  const category = body.category?.trim() || null
  const hasFile = Boolean(body.fileUrl?.trim())

  if (!content && !hasFile) {
    return c.json({ error: 'Bad Request', message: 'Content or file is required' }, 400)
  }

  const result = db.prepare(`
    INSERT INTO admin_section_posts (section, user_id, content, category, file_url, file_name, file_type, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    section,
    user.userId,
    content,
    category,
    body.fileUrl?.trim() || null,
    body.fileName?.trim() || null,
    body.fileType?.trim() || null,
    body.fileSize ?? null,
  )

  const post = db.prepare(`
    SELECT p.*, u.email AS user_email
    FROM admin_section_posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(result.lastInsertRowid) as DbRow

  const mappedPost = mapRow(post)
  wsManager.broadcast({ type: 'admin-content:created', data: mappedPost })
  return c.json({ post: mappedPost, success: true }, 201)
})

// Upsert a single keyed field: one canonical row per (section, category).
// Used by the per-card domain board so saving a field replaces it instead of
// appending duplicates.
adminContent.put('/:section/upsert', adminMiddleware, async (c) => {
  const section = c.req.param('section') as AdminSection
  if (!validSections.has(section)) {
    return c.json({ error: 'Bad Request', message: 'Invalid section' }, 400)
  }

  const user = c.get('user')
  const body = await c.req.json<{ category?: string; content?: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number }>()
  const category = body.category?.trim()
  if (!category) {
    return c.json({ error: 'Bad Request', message: 'Category is required for upsert' }, 400)
  }

  const content = body.content?.trim() || ''
  const fileUrl = body.fileUrl?.trim() || null
  const fileName = body.fileName?.trim() || null
  const fileType = body.fileType?.trim() || null
  const fileSize = body.fileSize ?? null

  if (!content && !fileUrl) {
    return c.json({ error: 'Bad Request', message: 'Content or file is required' }, 400)
  }

  const existing = db
    .prepare('SELECT id FROM admin_section_posts WHERE section = ? AND category = ? ORDER BY id DESC LIMIT 1')
    .get(section, category) as { id: number } | undefined

  let postId: number
  if (existing) {
    db.prepare(`
      UPDATE admin_section_posts
      SET content = ?, file_url = ?, file_name = ?, file_type = ?, file_size = ?
      WHERE id = ?
    `).run(content, fileUrl, fileName, fileType, fileSize, existing.id)
    postId = existing.id
  } else {
    const result = db.prepare(`
      INSERT INTO admin_section_posts (section, user_id, content, category, file_url, file_name, file_type, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(section, user.userId, content, category, fileUrl, fileName, fileType, fileSize)
    postId = Number(result.lastInsertRowid)
  }

  const post = db.prepare(`
    SELECT p.*, u.email AS user_email
    FROM admin_section_posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(postId) as DbRow

  const mappedPost = mapRow(post)
  wsManager.broadcast({ type: existing ? 'admin-content:updated' : 'admin-content:created', data: mappedPost })
  return c.json({ post: mappedPost, success: true })
})

adminContent.put('/:id', adminMiddleware, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'Invalid post id' }, 400)
  }

  const existing = db.prepare('SELECT * FROM admin_section_posts WHERE id = ?').get(id) as DbRow | undefined
  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Content not found' }, 404)
  }

  const body = await c.req.json<{ content?: string; category?: string | null; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number }>()
  const content = body.content?.trim() ?? existing.content
  const category = body.category === undefined ? existing.category : (body.category?.trim() || null)
  const fileUrl = body.fileUrl === undefined ? existing.file_url : (body.fileUrl?.trim() || null)
  const fileName = body.fileName === undefined ? existing.file_name : (body.fileName?.trim() || null)
  const fileType = body.fileType === undefined ? existing.file_type : (body.fileType?.trim() || null)
  const fileSize = body.fileSize === undefined ? existing.file_size : (body.fileSize ?? null)

  if (!content && !fileUrl) {
    return c.json({ error: 'Bad Request', message: 'Content or file is required' }, 400)
  }

  db.prepare(`
    UPDATE admin_section_posts
    SET content = ?, category = ?, file_url = ?, file_name = ?, file_type = ?, file_size = ?
    WHERE id = ?
  `).run(content, category, fileUrl, fileName, fileType, fileSize, id)

  const post = db.prepare(`
    SELECT p.*, u.email AS user_email
    FROM admin_section_posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(id) as DbRow

  const mappedPost = mapRow(post)
  wsManager.broadcast({ type: 'admin-content:updated', data: mappedPost })
  return c.json({ post: mappedPost, success: true })
})

adminContent.delete('/:id', adminMiddleware, (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: 'Bad Request', message: 'Invalid post id' }, 400)
  }

  const existing = db.prepare('SELECT * FROM admin_section_posts WHERE id = ?').get(id) as DbRow | undefined
  const result = db.prepare('DELETE FROM admin_section_posts WHERE id = ?').run(id)
  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Content not found' }, 404)
  }

  if (existing) wsManager.broadcast({ type: 'admin-content:deleted', data: { id, section: existing.section, category: existing.category } })
  return c.json({ success: true })
})

export { adminContent }
