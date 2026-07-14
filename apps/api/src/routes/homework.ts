import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { CreateHomeworkRequest, Homework, HomeworkSubmission } from '@teaching-app/shared'

const homework = new Hono()

interface DbHomework {
  id: number
  title: string
  description: string
  lecture_id: number | null
  group_id: number | null
  group_name?: string | null
  due_date: string | null
  solution: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
}

interface DbHomeworkSubmission {
  id: number
  homework_id: number
  user_id: number
  content: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  submitted_at: string
  user_email?: string
  user_full_name?: string | null
  homework_title?: string | null
  group_name?: string | null
  correction_text?: string | null
  correction_file_url?: string | null
  correction_file_name?: string | null
  correction_file_type?: string | null
  correction_file_size?: number | null
  corrected_at?: string | null
}

function mapHomework(row: DbHomework): Homework {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    lectureId: row.lecture_id,
    groupId: row.group_id,
    groupName: row.group_name ?? null,
    dueDate: row.due_date,
    solution: row.solution,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }
}

function mapSubmission(row: DbHomeworkSubmission): HomeworkSubmission {
  return {
    id: row.id,
    homeworkId: row.homework_id,
    userId: row.user_id,
    userEmail: row.user_email,
    userFullName: row.user_full_name ?? null,
    homeworkTitle: row.homework_title ?? null,
    groupName: row.group_name ?? null,
    content: row.content,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    correctionText: row.correction_text ?? null,
    correctionFileUrl: row.correction_file_url ?? null,
    correctionFileName: row.correction_file_name ?? null,
    correctionFileType: row.correction_file_type ?? null,
    correctionFileSize: row.correction_file_size ?? null,
    correctedAt: row.corrected_at ?? null,
    submittedAt: row.submitted_at,
  }
}

function canAccessGroup(groupId: number | null, user: { userId: number; role: string }) {
  if (!groupId || user.role === 'admin') return true
  const membership = db.prepare('SELECT id FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, user.userId)
  return Boolean(membership)
}

function getHomeworkById(id: number) {
  return db.prepare(`
    SELECT h.*, g.name as group_name
    FROM homework h
    LEFT JOIN project_groups g ON g.id = h.group_id
    WHERE h.id = ?
  `).get(id) as DbHomework | undefined
}

homework.get('/', authMiddleware, async (c) => {
  const user = c.get('user')
  const groupIdParam = c.req.query('groupId')
  const groupId = groupIdParam ? Number.parseInt(groupIdParam, 10) : null

  if (groupId && !canAccessGroup(groupId, user)) {
    return c.json({ error: 'Forbidden', message: 'You are not a member of this group' }, 403)
  }

  const params: (number | string)[] = []
  let where = ''

  if (groupId) {
    where = 'WHERE h.group_id = ?'
    params.push(groupId)
  } else if (user.role !== 'admin') {
    where = `WHERE h.group_id IS NULL OR h.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)`
    params.push(user.userId)
  }

  const rows = db
    .prepare(`
      SELECT h.*, g.name as group_name
      FROM homework h
      LEFT JOIN project_groups g ON g.id = h.group_id
      ${where}
      ORDER BY g.name ASC, h.created_at DESC
    `)
    .all(...params) as DbHomework[]

  return c.json({ homework: rows.map(mapHomework) })
})

homework.get('/:id', authMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')
  const row = getHomeworkById(id)

  if (!row) {
    return c.json({ error: 'Not Found', message: 'Homework not found' }, 404)
  }

  if (!canAccessGroup(row.group_id, user)) {
    return c.json({ error: 'Forbidden', message: 'You cannot open this group project' }, 403)
  }

  return c.json({ homework: mapHomework(row) })
})

homework.post('/', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<CreateHomeworkRequest>()
  const { title, description, lectureId, groupId, dueDate, fileUrl, fileName, fileType, fileSize } = body

  if (!title || !description) {
    return c.json({ error: 'Bad Request', message: 'Title and description are required' }, 400)
  }

  if (groupId) {
    const group = db.prepare('SELECT id FROM project_groups WHERE id = ?').get(groupId)
    if (!group) return c.json({ error: 'Bad Request', message: 'Group not found' }, 400)
  }

  const result = db
    .prepare('INSERT INTO homework (title, description, lecture_id, group_id, due_date, file_url, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(title, description, lectureId || null, groupId || null, dueDate || null, fileUrl || null, fileName || null, fileType || null, fileSize ?? null)

  const row = getHomeworkById(Number(result.lastInsertRowid)) as DbHomework
  const hw = mapHomework(row)

  wsManager.broadcast({ type: 'homework:created', data: hw })

  return c.json({ homework: hw, message: 'Homework created successfully' }, 201)
})

homework.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const body = await c.req.json<Partial<CreateHomeworkRequest> & { solution?: string }>()
  const { title, description, lectureId, groupId, dueDate, solution, fileUrl, fileName, fileType, fileSize } = body

  const existing = getHomeworkById(id)

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Homework not found' }, 404)
  }

  if (groupId) {
    const group = db.prepare('SELECT id FROM project_groups WHERE id = ?').get(groupId)
    if (!group) return c.json({ error: 'Bad Request', message: 'Group not found' }, 400)
  }

  db.prepare(
    'UPDATE homework SET title = ?, description = ?, lecture_id = ?, group_id = ?, due_date = ?, solution = ?, file_url = ?, file_name = ?, file_type = ?, file_size = ? WHERE id = ?'
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    lectureId !== undefined ? lectureId : existing.lecture_id,
    groupId !== undefined ? groupId : existing.group_id,
    dueDate !== undefined ? dueDate : existing.due_date,
    solution !== undefined ? solution : existing.solution,
    fileUrl !== undefined ? fileUrl : existing.file_url,
    fileName !== undefined ? fileName : existing.file_name,
    fileType !== undefined ? fileType : existing.file_type,
    fileSize !== undefined ? fileSize : existing.file_size,
    id
  )

  const row = getHomeworkById(id) as DbHomework
  const hw = mapHomework(row)

  wsManager.broadcast({ type: 'homework:updated', data: hw })

  return c.json({ homework: hw, message: 'Homework updated successfully' })
})

homework.patch('/:id/solution', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const { solution } = await c.req.json<{ solution?: string }>()

  const existing = getHomeworkById(id)

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Homework not found' }, 404)
  }

  db.prepare('UPDATE homework SET solution = ? WHERE id = ?').run(solution || null, id)

  const row = getHomeworkById(id) as DbHomework
  const hw = mapHomework(row)

  wsManager.broadcast({ type: 'homework:updated', data: hw })

  return c.json({ homework: hw, message: 'Solution updated successfully' })
})

homework.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)

  const result = db.prepare('DELETE FROM homework WHERE id = ?').run(id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Homework not found' }, 404)
  }

  wsManager.broadcast({ type: 'homework:deleted', data: { id } })

  return c.json({ message: 'Homework deleted successfully' })
})

homework.post('/:id/submit', authMiddleware, async (c) => {
  const homeworkId = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')
  const body = await c.req.json<{ content?: string; fileUrl?: string; fileName?: string; fileType?: string; fileSize?: number }>()
  const content = body.content?.trim() || ''
  const hasFile = Boolean(body.fileUrl?.trim())

  if (!content && !hasFile) {
    return c.json({ error: 'Bad Request', message: 'Content or file is required' }, 400)
  }

  const hw = getHomeworkById(homeworkId)
  if (!hw) {
    return c.json({ error: 'Not Found', message: 'Homework not found' }, 404)
  }

  if (!canAccessGroup(hw.group_id, user)) {
    return c.json({ error: 'Forbidden', message: 'You cannot submit this group project' }, 403)
  }

  const result = db
    .prepare('INSERT INTO homework_submissions (homework_id, user_id, content, file_url, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(
      homeworkId,
      user.userId,
      content,
      body.fileUrl?.trim() || null,
      body.fileName?.trim() || null,
      body.fileType?.trim() || null,
      body.fileSize ?? null,
    )

  const row = db
    .prepare('SELECT * FROM homework_submissions WHERE id = ?')
    .get(result.lastInsertRowid) as DbHomeworkSubmission

  return c.json({ submission: mapSubmission(row), message: 'Homework submitted successfully' }, 201)
})

homework.get('/:id/submissions', authMiddleware, async (c) => {
  const homeworkId = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')
  const hw = getHomeworkById(homeworkId)

  if (!hw) return c.json({ error: 'Not Found', message: 'Homework not found' }, 404)
  if (!canAccessGroup(hw.group_id, user)) {
    return c.json({ error: 'Forbidden', message: 'You cannot view this group project' }, 403)
  }

  const rows = db
    .prepare('SELECT * FROM homework_submissions WHERE homework_id = ? AND user_id = ? ORDER BY submitted_at DESC')
    .all(homeworkId, user.userId) as DbHomeworkSubmission[]

  return c.json({ submissions: rows.map(mapSubmission) })
})

homework.get('/:id/all-submissions', authMiddleware, adminMiddleware, async (c) => {
  const homeworkId = Number.parseInt(c.req.param('id'), 10)

  const rows = db
    .prepare(`
      SELECT hs.*, u.email as user_email, u.full_name as user_full_name
      FROM homework_submissions hs
      JOIN users u ON hs.user_id = u.id
      WHERE hs.homework_id = ?
      ORDER BY hs.submitted_at DESC
    `)
    .all(homeworkId) as DbHomeworkSubmission[]

  return c.json({ submissions: rows.map(mapSubmission) })
})

// All project submissions across every homework (admin corrections view).
homework.get('/submissions/all', authMiddleware, adminMiddleware, async (c) => {
  const rows = db
    .prepare(`
      SELECT hs.*, u.email as user_email, u.full_name as user_full_name,
             h.title as homework_title, g.name as group_name
      FROM homework_submissions hs
      JOIN users u ON hs.user_id = u.id
      JOIN homework h ON h.id = hs.homework_id
      LEFT JOIN project_groups g ON g.id = h.group_id
      ORDER BY hs.submitted_at DESC
    `)
    .all() as DbHomeworkSubmission[]

  return c.json({ submissions: rows.map(mapSubmission) })
})

homework.put('/submissions/:submissionId/correction', authMiddleware, adminMiddleware, async (c) => {
  const submissionId = Number.parseInt(c.req.param('submissionId'), 10)
  const body = await c.req.json<{
    correctionText?: string
    correctionFileUrl?: string | null
    correctionFileName?: string | null
    correctionFileType?: string | null
    correctionFileSize?: number | null
  }>()

  const existing = db.prepare('SELECT * FROM homework_submissions WHERE id = ?').get(submissionId) as DbHomeworkSubmission | undefined
  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Submission not found' }, 404)
  }

  db.prepare(`
    UPDATE homework_submissions
    SET correction_text = ?, correction_file_url = ?, correction_file_name = ?, correction_file_type = ?, correction_file_size = ?, corrected_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    body.correctionText || '',
    body.correctionFileUrl || null,
    body.correctionFileName || null,
    body.correctionFileType || null,
    body.correctionFileSize ?? null,
    submissionId,
  )

  const row = db
    .prepare(`
      SELECT hs.*, u.email as user_email, u.full_name as user_full_name,
             h.title as homework_title, g.name as group_name
      FROM homework_submissions hs
      JOIN users u ON hs.user_id = u.id
      JOIN homework h ON h.id = hs.homework_id
      LEFT JOIN project_groups g ON g.id = h.group_id
      WHERE hs.id = ?
    `)
    .get(submissionId) as DbHomeworkSubmission

  wsManager.broadcast({ type: 'homework:corrected', data: mapSubmission(row) })
  return c.json({ submission: mapSubmission(row), message: 'Correction saved successfully' })
})

homework.delete('/submissions/:submissionId', authMiddleware, adminMiddleware, async (c) => {
  const submissionId = Number.parseInt(c.req.param('submissionId'), 10)
  const existing = db.prepare('SELECT * FROM homework_submissions WHERE id = ?').get(submissionId) as DbHomeworkSubmission | undefined

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Submission not found' }, 404)
  }

  db.prepare('DELETE FROM homework_submissions WHERE id = ?').run(submissionId)
  wsManager.broadcast({ type: 'homework:submission-deleted', data: { id: submissionId, userId: existing.user_id, homeworkId: existing.homework_id } })
  return c.json({ message: 'Submission deleted successfully' })
})

export { homework }
