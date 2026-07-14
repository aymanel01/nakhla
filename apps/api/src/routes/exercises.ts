import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { Exercise, ExerciseField, CreateExerciseRequest, ExerciseSubmission, UnitEvaluationDomain } from '@teaching-app/shared'

const exercises = new Hono()

interface DbExercise {
  id: number
  title: string
  description: string
  fields: string
  lecture_id: number | null
  domain: UnitEvaluationDomain | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  order: number
  created_at: string
}

interface DbExerciseSubmission {
  id: number
  exercise_id: number
  user_id: number
  user_email?: string
  user_full_name?: string
  exercise_title?: string
  exercise_domain?: UnitEvaluationDomain | null
  answers: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  correction_text: string | null
  correction_file_url: string | null
  correction_file_name: string | null
  correction_file_type: string | null
  correction_file_size: number | null
  corrected_at: string | null
  submitted_at: string
}

function mapExercise(row: DbExercise): Exercise {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fields: JSON.parse(row.fields) as ExerciseField[],
    lectureId: row.lecture_id,
    domain: row.domain || 'social-economic',
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    order: row.order,
    createdAt: row.created_at,
  }
}

function mapSubmission(row: DbExerciseSubmission): ExerciseSubmission {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    userId: row.user_id,
    userEmail: row.user_email,
    userFullName: row.user_full_name,
    exerciseTitle: row.exercise_title,
    exerciseDomain: row.exercise_domain || undefined,
    answers: JSON.parse(row.answers || '{}'),
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    correctionText: row.correction_text,
    correctionFileUrl: row.correction_file_url,
    correctionFileName: row.correction_file_name,
    correctionFileType: row.correction_file_type,
    correctionFileSize: row.correction_file_size,
    correctedAt: row.corrected_at,
    submittedAt: row.submitted_at,
  }
}

exercises.get('/', async (c) => {
  const rows = db
    .prepare('SELECT * FROM exercises ORDER BY "order" ASC, created_at DESC')
    .all() as DbExercise[]

  return c.json({ exercises: rows.map(mapExercise) })
})


exercises.get('/submissions/all', authMiddleware, adminMiddleware, async (c) => {
  const rows = db
    .prepare(`
      SELECT es.*, u.email as user_email, u.full_name as user_full_name, e.title as exercise_title, e.domain as exercise_domain
      FROM exercise_submissions es
      JOIN users u ON u.id = es.user_id
      JOIN exercises e ON e.id = es.exercise_id
      ORDER BY es.submitted_at DESC
    `)
    .all() as DbExerciseSubmission[]

  return c.json({ submissions: rows.map(mapSubmission) })
})

exercises.get('/my-submissions', authMiddleware, async (c) => {
  const user = c.get('user')
  const rows = db
    .prepare(`
      SELECT es.*, u.email as user_email, u.full_name as user_full_name, e.title as exercise_title, e.domain as exercise_domain
      FROM exercise_submissions es
      JOIN users u ON u.id = es.user_id
      JOIN exercises e ON e.id = es.exercise_id
      WHERE es.user_id = ?
      ORDER BY es.submitted_at DESC
    `)
    .all(user.userId) as DbExerciseSubmission[]

  return c.json({ submissions: rows.map(mapSubmission) })
})

exercises.put('/submissions/:submissionId/correction', authMiddleware, adminMiddleware, async (c) => {
  const submissionId = Number.parseInt(c.req.param('submissionId'), 10)
  const body = await c.req.json<{
    correctionText?: string
    correctionFileUrl?: string | null
    correctionFileName?: string | null
    correctionFileType?: string | null
    correctionFileSize?: number | null
  }>()

  const existing = db.prepare('SELECT * FROM exercise_submissions WHERE id = ?').get(submissionId) as DbExerciseSubmission | undefined
  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Submission not found' }, 404)
  }

  db.prepare(`
    UPDATE exercise_submissions
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
      SELECT es.*, u.email as user_email, u.full_name as user_full_name, e.title as exercise_title, e.domain as exercise_domain
      FROM exercise_submissions es
      JOIN users u ON u.id = es.user_id
      JOIN exercises e ON e.id = es.exercise_id
      WHERE es.id = ?
    `)
    .get(submissionId) as DbExerciseSubmission

  wsManager.broadcast({ type: 'exercise:corrected', data: mapSubmission(row) })
  return c.json({ submission: mapSubmission(row), message: 'Correction saved successfully' })
})


exercises.delete('/submissions/:submissionId', authMiddleware, adminMiddleware, async (c) => {
  const submissionId = Number.parseInt(c.req.param('submissionId'), 10)
  const existing = db.prepare('SELECT * FROM exercise_submissions WHERE id = ?').get(submissionId) as DbExerciseSubmission | undefined

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Submission not found' }, 404)
  }

  db.prepare('DELETE FROM exercise_submissions WHERE id = ?').run(submissionId)
  wsManager.broadcast({ type: 'exercise:submission-deleted', data: { id: submissionId, userId: existing.user_id, exerciseId: existing.exercise_id } })
  return c.json({ message: 'Submission deleted successfully' })
})

exercises.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id) as DbExercise | undefined

  if (!row) {
    return c.json({ error: 'Not Found', message: 'Exercise not found' }, 404)
  }

  return c.json({ exercise: mapExercise(row) })
})

exercises.post('/', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<CreateExerciseRequest>()
  const { title, description, fields, lectureId, domain = 'social-economic', fileUrl, fileName, fileType, fileSize, order = 0 } = body

  if (!title || !description || !fields || !Array.isArray(fields)) {
    return c.json({ error: 'Bad Request', message: 'Title, description, and fields are required' }, 400)
  }

  const result = db
    .prepare('INSERT INTO exercises (title, description, fields, lecture_id, domain, file_url, file_name, file_type, file_size, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(title, description, JSON.stringify(fields), lectureId || null, domain, fileUrl || null, fileName || null, fileType || null, fileSize ?? null, order)

  const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(result.lastInsertRowid) as DbExercise
  const exercise = mapExercise(row)

  wsManager.broadcast({ type: 'exercise:created', data: exercise })

  return c.json({ exercise, message: 'Exercise created successfully' }, 201)
})

exercises.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const body = await c.req.json<Partial<CreateExerciseRequest>>()
  const { title, description, fields, lectureId, domain, fileUrl, fileName, fileType, fileSize, order } = body

  const existing = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id) as DbExercise | undefined

  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Exercise not found' }, 404)
  }

  db.prepare(
    'UPDATE exercises SET title = ?, description = ?, fields = ?, lecture_id = ?, domain = ?, file_url = ?, file_name = ?, file_type = ?, file_size = ?, "order" = ? WHERE id = ?'
  ).run(
    title ?? existing.title,
    description ?? existing.description,
    fields ? JSON.stringify(fields) : existing.fields,
    lectureId !== undefined ? lectureId : existing.lecture_id,
    domain !== undefined ? domain : (existing.domain || 'social-economic'),
    fileUrl !== undefined ? fileUrl : existing.file_url,
    fileName !== undefined ? fileName : existing.file_name,
    fileType !== undefined ? fileType : existing.file_type,
    fileSize !== undefined ? fileSize : existing.file_size,
    order ?? existing.order,
    id
  )

  const row = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id) as DbExercise
  const exercise = mapExercise(row)

  wsManager.broadcast({ type: 'exercise:updated', data: exercise })

  return c.json({ exercise, message: 'Exercise updated successfully' })
})

exercises.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)

  const result = db.prepare('DELETE FROM exercises WHERE id = ?').run(id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Exercise not found' }, 404)
  }

  wsManager.broadcast({ type: 'exercise:deleted', data: { id } })

  return c.json({ message: 'Exercise deleted successfully' })
})

exercises.post('/:id/submit', authMiddleware, async (c) => {
  const exerciseId = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')
  const { answers, fileUrl, fileName, fileType, fileSize } = await c.req.json<{ answers: Record<string, string>; fileUrl?: string; fileName?: string; fileType?: string | null; fileSize?: number | null }>()

  const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(exerciseId) as DbExercise | undefined

  if (!exercise) {
    return c.json({ error: 'Not Found', message: 'Exercise not found' }, 404)
  }

  const result = db
    .prepare('INSERT INTO exercise_submissions (exercise_id, user_id, answers, file_url, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(exerciseId, user.userId, JSON.stringify(answers || {}), fileUrl || null, fileName || null, fileType || null, fileSize ?? null)

  const row = db
    .prepare(`
      SELECT es.*, u.email as user_email, u.full_name as user_full_name, e.title as exercise_title, e.domain as exercise_domain
      FROM exercise_submissions es
      JOIN users u ON u.id = es.user_id
      JOIN exercises e ON e.id = es.exercise_id
      WHERE es.id = ?
    `)
    .get(result.lastInsertRowid) as DbExerciseSubmission

  const submission = mapSubmission(row)
  wsManager.broadcast({ type: 'exercise:submitted', data: submission })
  return c.json({ submission, message: 'Exercise submitted successfully' }, 201)
})

exercises.get('/:id/submissions', authMiddleware, async (c) => {
  const exerciseId = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')

  const rows = db
    .prepare(`
      SELECT es.*, u.email as user_email, u.full_name as user_full_name, e.title as exercise_title, e.domain as exercise_domain
      FROM exercise_submissions es
      JOIN users u ON u.id = es.user_id
      JOIN exercises e ON e.id = es.exercise_id
      WHERE es.exercise_id = ? AND es.user_id = ?
      ORDER BY es.submitted_at DESC
    `)
    .all(exerciseId, user.userId) as DbExerciseSubmission[]

  return c.json({ submissions: rows.map(mapSubmission) })
})

export { exercises }
