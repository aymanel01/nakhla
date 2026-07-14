import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import type { ContentProgressItemType, StudentFullProgress, UserContentProgress } from '@teaching-app/shared'

const progress = new Hono()

progress.use('*', authMiddleware)

const allowedItemTypes = new Set<ContentProgressItemType>(['lecture', 'domain_component'])

function countScalar(query: string, ...params: (string | number)[]) {
  const row = db.prepare(query).get(...params) as { count: number } | undefined
  return Number(row?.count || 0)
}

function getLastActivity(userId: number) {
  const row = db.prepare(`
    SELECT MAX(activity_at) as last_activity FROM (
      SELECT submitted_at as activity_at FROM quiz_attempts WHERE user_id = ?
      UNION ALL
      SELECT submitted_at as activity_at FROM exercise_submissions WHERE user_id = ?
      UNION ALL
      SELECT submitted_at as activity_at FROM homework_submissions WHERE user_id = ?
      UNION ALL
      SELECT completed_at as activity_at FROM user_content_progress WHERE user_id = ?
    )
  `).get(userId, userId, userId, userId) as { last_activity: string | null } | undefined
  return row?.last_activity ?? null
}

const domainComponentLabels = [
  { id: 'social-economic:reading', label: 'فهم المقروء' },
  { id: 'social-economic:listening', label: 'فهم المسموع' },
  { id: 'social-economic:language', label: 'الظاهرة اللغوية' },
  { id: 'social-economic:writing', label: 'الإنتاج الكتابي' },
]

function splitCompletedRemaining(allItems: { id: string; label: string }[], completedIds: Set<string>) {
  return {
    completed: allItems.filter((item) => completedIds.has(item.id)).map((item) => item.label),
    remaining: allItems.filter((item) => !completedIds.has(item.id)).map((item) => item.label),
  }
}

function getUserProgressDetails(userId: number, totalHomeworkQuery: string) {
  const palaceRows = db.prepare(`
    SELECT stage_number, stage_type
    FROM quiz_game_stage_progress
    WHERE user_id = ? AND completed = 1
    ORDER BY stage_type, stage_number
  `).all(userId) as { stage_number: number; stage_type: string }[]
  const completedPalace = new Set(palaceRows.map((row) => `${row.stage_type}:${row.stage_number}`))
  const palaceItems = [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `main:${index + 1}`, label: `باب القصر ${index + 1}` })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `bonus:${index + 1}`, label: `سؤال المسار ${index + 1}` })),
  ]

  const contentRows = db.prepare(`
    SELECT item_type, item_id
    FROM user_content_progress
    WHERE user_id = ?
  `).all(userId) as { item_type: string; item_id: string }[]
  const completedDomains = new Set(contentRows.filter((row) => row.item_type === 'domain_component').map((row) => row.item_id))
  const completedLectureIds = new Set(contentRows.filter((row) => row.item_type === 'lecture').map((row) => row.item_id))

  const lectureRows = db.prepare('SELECT id, title FROM lectures ORDER BY "order" ASC, id ASC').all() as { id: number; title: string }[]
  const exerciseRows = db.prepare('SELECT id, title FROM exercises ORDER BY "order" ASC, id ASC').all() as { id: number; title: string }[]
  const submittedExercises = new Set((db.prepare('SELECT DISTINCT exercise_id FROM exercise_submissions WHERE user_id = ?').all(userId) as { exercise_id: number }[]).map((row) => String(row.exercise_id)))

  const homeworkRows = db.prepare(totalHomeworkQuery).all(userId) as { id: number; title: string }[]
  const submittedHomework = new Set((db.prepare('SELECT DISTINCT homework_id FROM homework_submissions WHERE user_id = ?').all(userId) as { homework_id: number }[]).map((row) => String(row.homework_id)))

  return {
    palace: splitCompletedRemaining(palaceItems, completedPalace),
    domains: splitCompletedRemaining(domainComponentLabels, completedDomains),
    lectures: splitCompletedRemaining(lectureRows.map((row) => ({ id: String(row.id), label: row.title })), completedLectureIds),
    exercises: splitCompletedRemaining(exerciseRows.map((row) => ({ id: String(row.id), label: row.title })), submittedExercises),
    homework: splitCompletedRemaining(homeworkRows.map((row) => ({ id: String(row.id), label: row.title })), submittedHomework),
  }
}


progress.get('/me', async (c) => {
  const user = c.get('user')
  const rows = db.prepare(`
    SELECT item_type, item_id, completed_at
    FROM user_content_progress
    WHERE user_id = ?
    ORDER BY completed_at DESC
  `).all(user.userId) as { item_type: ContentProgressItemType; item_id: string; completed_at: string }[]

  const items: UserContentProgress[] = rows.map((row) => ({
    itemType: row.item_type,
    itemId: row.item_id,
    completedAt: row.completed_at,
  }))

  return c.json({ progress: items })
})

progress.post('/content', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ itemType?: ContentProgressItemType; itemId?: string }>()
  const itemType = body.itemType
  const itemId = body.itemId?.trim()

  if (!itemType || !allowedItemTypes.has(itemType) || !itemId) {
    return c.json({ error: 'Bad Request', message: 'itemType and itemId are required' }, 400)
  }

  db.prepare(`
    INSERT INTO user_content_progress (user_id, item_type, item_id)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_type, item_id) DO UPDATE SET completed_at = CURRENT_TIMESTAMP
  `).run(user.userId, itemType, itemId)

  return c.json({ success: true })
})

progress.get('/admin/students', adminMiddleware, async (c) => {
  const totalPalace = 10
  const totalDomains = 4
  const totalLectures = countScalar('SELECT COUNT(*) as count FROM lectures')
  const totalExercises = countScalar('SELECT COUNT(*) as count FROM exercises')

  const rows = db.prepare(`
    SELECT id, email
    FROM users
    WHERE role = 'user'
    ORDER BY email ASC
  `).all() as { id: number; email: string }[]

  const students: StudentFullProgress[] = rows.map((user) => {
    const userHomeworkQuery = `
      SELECT h.id, h.title
      FROM homework h
      WHERE h.group_id IS NULL
         OR h.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
      ORDER BY h.created_at DESC, h.id DESC
    `
    const totalHomework = countScalar(`
      SELECT COUNT(*) as count
      FROM homework h
      WHERE h.group_id IS NULL
         OR h.group_id IN (SELECT group_id FROM group_members WHERE user_id = ?)
    `, user.id)
    const details = getUserProgressDetails(user.id, userHomeworkQuery)

    const averageRow = db.prepare(`
      SELECT AVG(CAST(score AS FLOAT) / NULLIF(total_questions, 0) * 100) as average_score,
             COUNT(*) as total_attempts
      FROM quiz_attempts
      WHERE user_id = ?
    `).get(user.id) as { average_score: number | null; total_attempts: number } | undefined

    return {
      id: user.id,
      email: user.email,
      palace: {
        completed: countScalar('SELECT COUNT(*) as count FROM quiz_game_stage_progress WHERE user_id = ? AND completed = 1', user.id),
        total: totalPalace,
      },
      domains: {
        completed: countScalar("SELECT COUNT(*) as count FROM user_content_progress WHERE user_id = ? AND item_type = 'domain_component'", user.id),
        total: totalDomains,
      },
      lectures: {
        completed: countScalar("SELECT COUNT(*) as count FROM user_content_progress WHERE user_id = ? AND item_type = 'lecture'", user.id),
        total: totalLectures,
      },
      exercises: {
        completed: countScalar('SELECT COUNT(DISTINCT exercise_id) as count FROM exercise_submissions WHERE user_id = ?', user.id),
        total: totalExercises,
      },
      homework: {
        completed: countScalar('SELECT COUNT(DISTINCT homework_id) as count FROM homework_submissions WHERE user_id = ?', user.id),
        total: totalHomework,
      },
      details,
      averageScore: averageRow?.average_score ? Math.round(averageRow.average_score) : 0,
      totalAttempts: Number(averageRow?.total_attempts || 0),
      lastActivity: getLastActivity(user.id),
    }
  })

  return c.json({ students })
})

export { progress }
