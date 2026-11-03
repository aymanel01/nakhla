import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { CreateTarkibSubmissionRequest, TarkibSubmission } from '@teaching-app/shared'

const tarkib = new Hono()

interface DbTarkibSubmission {
  id: number
  user_id: number
  title: string
  display_name: string | null
  answer: string
  submitted_at: string
  user_email?: string
  user_full_name?: string | null
}

function mapSubmission(row: DbTarkibSubmission): TarkibSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userFullName: row.user_full_name ?? null,
    displayName: row.display_name,
    title: row.title,
    answer: row.answer,
    submittedAt: row.submitted_at,
  }
}

tarkib.post('/submit', authMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<CreateTarkibSubmissionRequest>()
  const answer = body.answer?.trim() || ''
  if (!answer) {
    return c.json({ error: 'Bad Request', message: 'Answer is required' }, 400)
  }

  const title = body.title?.trim() || 'التركيب'
  const displayName = body.displayName?.trim() || null

  const result = db
    .prepare('INSERT INTO tarkib_submissions (user_id, title, display_name, answer) VALUES (?, ?, ?, ?)')
    .run(user.userId, title, displayName, answer)

  const row = db
    .prepare(`
      SELECT ts.*, u.email as user_email, u.full_name as user_full_name
      FROM tarkib_submissions ts
      JOIN users u ON u.id = ts.user_id
      WHERE ts.id = ?
    `)
    .get(result.lastInsertRowid) as DbTarkibSubmission

  const submission = mapSubmission(row)
  wsManager.broadcast({ type: 'tarkib:submitted', data: submission })
  return c.json({ submission, message: 'Tarkib submitted successfully' }, 201)
})

tarkib.get('/admin', authMiddleware, adminMiddleware, async (c) => {
  const rows = db
    .prepare(`
      SELECT ts.*, u.email as user_email, u.full_name as user_full_name
      FROM tarkib_submissions ts
      JOIN users u ON u.id = ts.user_id
      ORDER BY ts.submitted_at DESC
    `)
    .all() as DbTarkibSubmission[]

  return c.json({ submissions: rows.map(mapSubmission) })
})

tarkib.delete('/admin/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const result = db.prepare('DELETE FROM tarkib_submissions WHERE id = ?').run(id)
  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Submission not found' }, 404)
  }
  return c.json({ message: 'Submission deleted successfully' })
})

export { tarkib }
