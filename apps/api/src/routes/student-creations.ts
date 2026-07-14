import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { CreateStudentCreationRequest, StudentCreation, StudentCreationType } from '@teaching-app/shared'

const studentCreations = new Hono()

const validTypes = new Set<StudentCreationType>(['بودكاست', 'قصص مصورة', 'قصص قصيرة', 'صورة و تعليق'])

interface DbStudentCreation {
  id: number
  title: string
  type: StudentCreationType
  description: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  thumbnail_url: string | null
  created_by: number
  created_at: string
}

function mapCreation(row: DbStudentCreation): StudentCreation {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    description: row.description,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    thumbnailUrl: row.thumbnail_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

studentCreations.use('*', authMiddleware)

studentCreations.get('/', (c) => {
  const type = c.req.query('type')?.trim() as StudentCreationType | undefined
  const params: unknown[] = []
  const where: string[] = []

  if (type) {
    if (!validTypes.has(type)) {
      return c.json({ error: 'Bad Request', message: 'Invalid creation type' }, 400)
    }
    where.push('type = ?')
    params.push(type)
  }

  const rows = db.prepare(`
    SELECT *
    FROM student_creations
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
  `).all(...params) as DbStudentCreation[]

  return c.json({ creations: rows.map(mapCreation) })
})

studentCreations.post('/', adminMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<CreateStudentCreationRequest>()
  const type = body.type

  if (!body.title?.trim() || !type) {
    return c.json({ error: 'Bad Request', message: 'Title and type are required' }, 400)
  }

  if (!validTypes.has(type)) {
    return c.json({ error: 'Bad Request', message: 'Invalid creation type' }, 400)
  }

  const hasFile = Boolean(body.fileUrl?.trim())
  if (!body.description?.trim() && !hasFile) {
    return c.json({ error: 'Bad Request', message: 'Description or file is required' }, 400)
  }

  const result = db.prepare(`
    INSERT INTO student_creations (title, type, description, file_url, file_name, file_type, file_size, thumbnail_url, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.title.trim(),
    type,
    body.description?.trim() || null,
    body.fileUrl?.trim() || null,
    body.fileName?.trim() || null,
    body.fileType?.trim() || null,
    body.fileSize ?? null,
    body.thumbnailUrl?.trim() || null,
    user.userId,
  )

  const row = db.prepare('SELECT * FROM student_creations WHERE id = ?').get(result.lastInsertRowid) as DbStudentCreation
  const creation = mapCreation(row)
  wsManager.broadcast({ type: 'student-creation:created', data: creation })
  return c.json({ creation, success: true }, 201)
})

studentCreations.put('/:id', adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const existing = db.prepare('SELECT * FROM student_creations WHERE id = ?').get(id) as DbStudentCreation | undefined

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Creation not found' }, 404)
  }

  const body = await c.req.json<Partial<CreateStudentCreationRequest>>()
  const type = body.type ?? existing.type
  if (!validTypes.has(type)) {
    return c.json({ error: 'Bad Request', message: 'Invalid creation type' }, 400)
  }

  db.prepare(`
    UPDATE student_creations
    SET title = ?, type = ?, description = ?, file_url = ?, file_name = ?, file_type = ?, file_size = ?, thumbnail_url = ?
    WHERE id = ?
  `).run(
    body.title?.trim() || existing.title,
    type,
    body.description !== undefined ? (body.description?.trim() || null) : existing.description,
    body.fileUrl !== undefined ? (body.fileUrl?.trim() || null) : existing.file_url,
    body.fileName !== undefined ? (body.fileName?.trim() || null) : existing.file_name,
    body.fileType !== undefined ? (body.fileType?.trim() || null) : existing.file_type,
    body.fileSize !== undefined ? (body.fileSize ?? null) : existing.file_size,
    body.thumbnailUrl !== undefined ? (body.thumbnailUrl?.trim() || null) : existing.thumbnail_url,
    id,
  )

  const row = db.prepare('SELECT * FROM student_creations WHERE id = ?').get(id) as DbStudentCreation
  const creation = mapCreation(row)
  wsManager.broadcast({ type: 'student-creation:created', data: creation })
  return c.json({ creation, success: true })
})

studentCreations.delete('/:id', adminMiddleware, (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const result = db.prepare('DELETE FROM student_creations WHERE id = ?').run(id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Creation not found' }, 404)
  }

  wsManager.broadcast({ type: 'student-creation:deleted', data: { id } })
  return c.json({ success: true, message: 'Creation deleted successfully' })
})

export { studentCreations }
