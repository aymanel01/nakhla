import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { Lecture, CreateLectureRequest } from '@teaching-app/shared'

const lectures = new Hono()

interface DbLecture {
  id: number
  title: string
  description: string
  youtube_url: string
  key_points: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  thumbnail_url: string | null
  order: number
  created_at: string
}

function mapLecture(row: DbLecture): Lecture {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    youtubeUrl: row.youtube_url,
    keyPoints: row.key_points,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    thumbnailUrl: row.thumbnail_url,
    order: row.order,
    createdAt: row.created_at,
  }
}

lectures.get('/', async (c) => {
  const rows = db
    .prepare('SELECT * FROM lectures ORDER BY "order" ASC, created_at DESC')
    .all() as DbLecture[]

  return c.json({ lectures: rows.map(mapLecture) })
})

lectures.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const row = db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) as DbLecture | undefined

  if (!row) {
    return c.json({ error: 'Not Found', message: 'Lecture not found' }, 404)
  }

  return c.json({ lecture: mapLecture(row) })
})

lectures.post('/', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<CreateLectureRequest>()
  const { title, description, youtubeUrl, keyPoints, fileUrl, fileName, fileType, fileSize, thumbnailUrl, order = 0 } = body

  if (!title || !description || (!youtubeUrl && !fileUrl)) {
    return c.json({ error: 'Bad Request', message: 'Title, description, and a video/file are required' }, 400)
  }

  const result = db
    .prepare('INSERT INTO lectures (title, description, youtube_url, key_points, file_url, file_name, file_type, file_size, thumbnail_url, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(title, description, youtubeUrl || '', keyPoints || null, fileUrl || null, fileName || null, fileType || null, fileSize ?? null, thumbnailUrl || null, order)

  const row = db.prepare('SELECT * FROM lectures WHERE id = ?').get(result.lastInsertRowid) as DbLecture
  const lecture = mapLecture(row)

  wsManager.broadcast({ type: 'lecture:created', data: lecture })

  return c.json({ lecture, message: 'Lecture created successfully' }, 201)
})

lectures.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const body = await c.req.json<Partial<CreateLectureRequest>>()
  const { title, description, youtubeUrl, keyPoints, fileUrl, fileName, fileType, fileSize, thumbnailUrl, order } = body

  const existing = db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) as DbLecture | undefined

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Lecture not found' }, 404)
  }

  db.prepare(
    'UPDATE lectures SET title = ?, description = ?, youtube_url = ?, key_points = ?, file_url = ?, file_name = ?, file_type = ?, file_size = ?, thumbnail_url = ?, "order" = ? WHERE id = ?'
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    youtubeUrl !== undefined ? youtubeUrl : existing.youtube_url,
    keyPoints !== undefined ? keyPoints : existing.key_points,
    fileUrl !== undefined ? fileUrl : existing.file_url,
    fileName !== undefined ? fileName : existing.file_name,
    fileType !== undefined ? fileType : existing.file_type,
    fileSize !== undefined ? fileSize : existing.file_size,
    thumbnailUrl !== undefined ? thumbnailUrl : existing.thumbnail_url,
    order ?? existing.order,
    id
  )

  const row = db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) as DbLecture
  const lecture = mapLecture(row)

  wsManager.broadcast({ type: 'lecture:updated', data: lecture })

  return c.json({ lecture, message: 'Lecture updated successfully' })
})

lectures.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)

  const result = db.prepare('DELETE FROM lectures WHERE id = ?').run(id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Lecture not found' }, 404)
  }

  wsManager.broadcast({ type: 'lecture:deleted', data: { id } })

  return c.json({ message: 'Lecture deleted successfully' })
})

export { lectures }
