import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import type { Quiz, QuizQuestion, CreateQuizRequest, QuizAttempt, QuizDifficulty } from '@teaching-app/shared'

const quizzes = new Hono()

type StageType = 'main' | 'bonus'

interface DbQuiz {
  id: number
  title: string
  description: string
  questions: string
  difficulty: QuizDifficulty
  lecture_id: number | null
  lecture_title: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  created_at: string
}

interface DbQuizAttempt {
  id: number
  quiz_id: number
  user_id: number
  answers: string
  score: number
  total_questions: number
  submitted_at: string
}

interface DbGameProfile {
  user_id: number
  unlocked_stage: number
  current_stage: number
  best_stage: number
  total_stars: number
  total_rewards: number
  sound_enabled: number
  updated_at: string
}

interface DbStageProgress {
  user_id: number
  stage_number: number
  stage_type: StageType
  completed: number
  stars_earned: number
  reward_earned: number
  updated_at: string
}

interface DbStageConfig {
  id: number
  stage_type: StageType
  stage_number: number
  title: string
  image: string | null
  questions: string
  created_at: string
  updated_at: string
}

interface StageConfigPayload {
  stageType: StageType
  stageNumber: number
  title: string
  image: string | null
  questions: QuizQuestion[]
}

function mapQuiz(row: DbQuiz): Quiz {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    questions: JSON.parse(row.questions) as QuizQuestion[],
    difficulty: row.difficulty || 'medium',
    lectureId: row.lecture_id,
    lectureTitle: row.lecture_title || undefined,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
  }
}

function mapAttempt(row: DbQuizAttempt): QuizAttempt {
  return {
    id: row.id,
    quizId: row.quiz_id,
    userId: row.user_id,
    answers: JSON.parse(row.answers),
    score: row.score,
    totalQuestions: row.total_questions,
    submittedAt: row.submitted_at,
  }
}


function mapStageConfig(row: DbStageConfig): StageConfigPayload {
  return {
    stageType: row.stage_type,
    stageNumber: row.stage_number,
    title: row.title,
    image: row.image,
    questions: JSON.parse(row.questions) as QuizQuestion[],
  }
}

function listStageConfigs() {
  const rows = db.prepare(`
    SELECT * FROM quiz_stage_configs
    WHERE (stage_type = 'main' AND stage_number BETWEEN 1 AND 5)
       OR (stage_type = 'bonus' AND stage_number BETWEEN 1 AND 5)
    ORDER BY CASE WHEN stage_type = 'main' THEN 0 ELSE 1 END, stage_number ASC
  `).all() as DbStageConfig[]

  return rows.map(mapStageConfig)
}

function ensureGameProfile(userId: number): DbGameProfile {
  const existing = db.prepare('SELECT * FROM quiz_game_profiles WHERE user_id = ?').get(userId) as DbGameProfile | undefined

  if (existing) {
    return existing
  }

  db.prepare(`
    INSERT INTO quiz_game_profiles (
      user_id, unlocked_stage, current_stage, best_stage, total_stars, total_rewards, sound_enabled
    ) VALUES (?, 1, 1, 0, 0, 0, 1)
  `).run(userId)

  return db.prepare('SELECT * FROM quiz_game_profiles WHERE user_id = ?').get(userId) as DbGameProfile
}

function getGameSnapshot(userId: number) {
  const profile = ensureGameProfile(userId)
  const stageRows = db.prepare(`
    SELECT * FROM quiz_game_stage_progress
    WHERE user_id = ?
    ORDER BY stage_type, stage_number
  `).all(userId) as DbStageProgress[]

  const completedMainStages = stageRows.filter((row) => row.stage_type === 'main' && row.completed).map((row) => row.stage_number)
  const completedBonusStages = stageRows.filter((row) => row.stage_type === 'bonus' && row.completed).map((row) => row.stage_number)

  const leaderboard = db.prepare(`
    SELECT
      u.id,
      u.email,
      COALESCE(g.unlocked_stage, 1) as unlocked_stage,
      COALESCE(g.current_stage, 1) as current_stage,
      COALESCE(g.best_stage, 0) as best_stage,
      COALESCE(g.total_stars, 0) as total_stars,
      COALESCE(g.total_rewards, 0) as total_rewards,
      COALESCE(MAX(sp.updated_at), g.updated_at) as last_progress_at
    FROM users u
    LEFT JOIN quiz_game_profiles g ON g.user_id = u.id
    LEFT JOIN quiz_game_stage_progress sp ON sp.user_id = u.id
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY best_stage DESC, total_stars DESC, total_rewards DESC, last_progress_at ASC, email ASC
  `).all() as {
    id: number
    email: string
    unlocked_stage: number
    current_stage: number
    best_stage: number
    total_stars: number
    total_rewards: number
    last_progress_at: string | null
  }[]

  const monthKey = db.prepare(`SELECT strftime('%Y-%m', 'now', 'localtime') as month_key`).get() as { month_key: string }

  const monthlyChampion = db.prepare(`
    SELECT
      u.id,
      u.email,
      SUM(sp.reward_earned) as reward_points,
      SUM(sp.stars_earned) as stars,
      MAX(sp.stage_number) as best_stage
    FROM quiz_game_stage_progress sp
    JOIN users u ON u.id = sp.user_id
    WHERE u.role = 'user'
      AND strftime('%Y-%m', sp.updated_at, 'localtime') = ?
    GROUP BY u.id
    ORDER BY reward_points DESC, stars DESC, best_stage DESC, email ASC
    LIMIT 1
  `).get(monthKey.month_key) as {
    id: number
    email: string
    reward_points: number
    stars: number
    best_stage: number
  } | undefined

  return {
    profile: {
      unlockedStage: profile.unlocked_stage,
      currentStage: profile.current_stage,
      bestStage: profile.best_stage,
      totalStars: profile.total_stars,
      totalRewards: profile.total_rewards,
      soundEnabled: Boolean(profile.sound_enabled),
      completedMainStages,
      completedBonusStages,
    },
    leaderboard: leaderboard.map((entry, index) => ({
      rank: index + 1,
      id: entry.id,
      email: entry.email,
      unlockedStage: entry.unlocked_stage,
      currentStage: entry.current_stage,
      bestStage: entry.best_stage,
      totalStars: entry.total_stars,
      totalRewards: entry.total_rewards,
      stopStage: Math.max(1, entry.current_stage),
      lastProgressAt: entry.last_progress_at,
    })),
    monthlyChampion: monthlyChampion
      ? {
          id: monthlyChampion.id,
          email: monthlyChampion.email,
          rewardPoints: monthlyChampion.reward_points,
          stars: monthlyChampion.stars,
          bestStage: monthlyChampion.best_stage,
          monthlyPrizeDh: 100,
        }
      : null,
  }
}


quizzes.get('/game/config', authMiddleware, async (c) => {
  return c.json({ stages: listStageConfigs() })
})

quizzes.get('/admin/stage-config', authMiddleware, adminMiddleware, async (c) => {
  return c.json({ stages: listStageConfigs() })
})

quizzes.put('/admin/stage-config/:stageType/:stageNumber', authMiddleware, adminMiddleware, async (c) => {
  const stageType: StageType = c.req.param('stageType') === 'bonus' ? 'bonus' : 'main'
  const stageNumber = Number.parseInt(c.req.param('stageNumber'), 10)
  const body = await c.req.json<{
    title?: string
    image?: string | null
    questions?: QuizQuestion[]
  }>()

  if (!stageNumber || stageNumber < 1 || stageNumber > 5 || !Array.isArray(body.questions)) {
    return c.json({ error: 'Bad Request', message: 'stageNumber must be between 1 and 5 and questions are required' }, 400)
  }

  const title = body.title?.trim() || (stageType === 'main' ? `الباب ${stageNumber}` : `سؤال المسار ${stageNumber}`)
  const image = body.image?.trim() || null
  const maxQuestions = stageType === 'main' ? 4 : 1
  const questions = body.questions
    .filter((question) => question.question?.trim() && Array.isArray(question.options) && question.options.length >= 2)
    .map((question, index) => ({
      ...question,
      id: question.id || `${stageType}-${stageNumber}-${index + 1}`,
      options: question.options.slice(0, 4),
      correctAnswer: Math.max(0, Math.min(Number(question.correctAnswer || 0), Math.min(question.options.length, 4) - 1)),
    }))
    .slice(0, maxQuestions)

  db.prepare(`
    INSERT INTO quiz_stage_configs (stage_type, stage_number, title, image, questions, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(stage_type, stage_number) DO UPDATE SET
      title = excluded.title,
      image = excluded.image,
      questions = excluded.questions,
      updated_at = CURRENT_TIMESTAMP
  `).run(stageType, stageNumber, title, image, JSON.stringify(questions))

  return c.json({ success: true, stages: listStageConfigs() })
})

quizzes.delete('/admin/stage-config/:stageType/:stageNumber', authMiddleware, adminMiddleware, async (c) => {
  const stageType: StageType = c.req.param('stageType') === 'bonus' ? 'bonus' : 'main'
  const stageNumber = Number.parseInt(c.req.param('stageNumber'), 10)
  if (!stageNumber || stageNumber < 1 || stageNumber > 5) {
    return c.json({ error: 'Bad Request', message: 'stageNumber must be between 1 and 5' }, 400)
  }

  db.prepare('DELETE FROM quiz_stage_configs WHERE stage_type = ? AND stage_number = ?').run(stageType, stageNumber)
  return c.json({ success: true, stages: listStageConfigs() })
})

quizzes.get('/game/me', authMiddleware, async (c) => {
  const user = c.get('user')
  return c.json(getGameSnapshot(user.userId))
})

quizzes.put('/game/sound', authMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ soundEnabled?: boolean }>()
  const profile = ensureGameProfile(user.userId)
  const soundEnabled = body.soundEnabled === undefined ? Boolean(profile.sound_enabled) : body.soundEnabled

  db.prepare(`
    UPDATE quiz_game_profiles
    SET sound_enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(soundEnabled ? 1 : 0, user.userId)

  return c.json(getGameSnapshot(user.userId))
})

quizzes.post('/game/progress', authMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{
    stageNumber?: number
    stageType?: StageType
    starsEarned?: number
    rewardEarned?: number
    soundEnabled?: boolean
    passed?: boolean
  }>()

  const stageNumber = Number(body.stageNumber || 0)
  const stageType: StageType = body.stageType === 'bonus' ? 'bonus' : 'main'
  const starsEarned = Math.max(0, Math.min(3, Number(body.starsEarned || 0)))
  const rewardEarned = Math.max(0, Number(body.rewardEarned || 0))
  const passed = Boolean(body.passed)

  if (!stageNumber || stageNumber < 1 || stageNumber > 5) {
    return c.json({ error: 'Bad Request', message: 'stageNumber must be between 1 and 5' }, 400)
  }

  const profile = ensureGameProfile(user.userId)
  const existing = db.prepare(`
    SELECT * FROM quiz_game_stage_progress
    WHERE user_id = ? AND stage_number = ? AND stage_type = ?
  `).get(user.userId, stageNumber, stageType) as DbStageProgress | undefined

  const nextStars = existing ? Math.max(existing.stars_earned, starsEarned) : starsEarned
  const nextReward = existing ? Math.max(existing.reward_earned, rewardEarned) : rewardEarned
  const deltaStars = nextStars - (existing?.stars_earned || 0)
  const deltaRewards = nextReward - (existing?.reward_earned || 0)

  if (existing) {
    db.prepare(`
      UPDATE quiz_game_stage_progress
      SET completed = ?, stars_earned = ?, reward_earned = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND stage_number = ? AND stage_type = ?
    `).run(passed ? 1 : existing.completed, nextStars, nextReward, user.userId, stageNumber, stageType)
  } else {
    db.prepare(`
      INSERT INTO quiz_game_stage_progress (
        user_id, stage_number, stage_type, completed, stars_earned, reward_earned
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(user.userId, stageNumber, stageType, passed ? 1 : 0, nextStars, nextReward)
  }

  let unlockedStage = profile.unlocked_stage
  let currentStage = profile.current_stage
  let bestStage = profile.best_stage

  if (stageType === 'main') {
    if (passed) {
      unlockedStage = Math.min(6, Math.max(profile.unlocked_stage, stageNumber + 1))
      currentStage = Math.min(6, Math.max(profile.current_stage, stageNumber + 1))
      bestStage = Math.min(5, Math.max(profile.best_stage, stageNumber))
    } else {
      unlockedStage = Math.max(profile.unlocked_stage, stageNumber)
      currentStage = Math.max(1, Math.min(profile.current_stage, stageNumber))
      bestStage = Math.max(profile.best_stage, stageNumber - 1)
    }
  }

  db.prepare(`
    UPDATE quiz_game_profiles
    SET
      unlocked_stage = ?,
      current_stage = ?,
      best_stage = ?,
      total_stars = total_stars + ?,
      total_rewards = total_rewards + ?,
      sound_enabled = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    unlockedStage,
    currentStage,
    bestStage,
    deltaStars,
    deltaRewards,
    body.soundEnabled === undefined ? profile.sound_enabled : body.soundEnabled ? 1 : 0,
    user.userId,
  )

  return c.json(getGameSnapshot(user.userId))
})

quizzes.get('/stats/me', authMiddleware, async (c) => {
  const user = c.get('user')

  const completedQuizzes = db.prepare(`
    SELECT COUNT(DISTINCT quiz_id) as count FROM quiz_attempts WHERE user_id = ?
  `).get(user.userId) as { count: number }

  const avgScore = db.prepare(`
    SELECT AVG(CAST(score AS FLOAT) / total_questions * 100) as avg
    FROM quiz_attempts WHERE user_id = ?
  `).get(user.userId) as { avg: number | null }

  const totalAttempts = db.prepare(`
    SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ?
  `).get(user.userId) as { count: number }

  const completedIds = db.prepare(`
    SELECT DISTINCT quiz_id FROM quiz_attempts WHERE user_id = ?
  `).all(user.userId) as { quiz_id: number }[]

  return c.json({
    stats: {
      completedQuizzes: completedQuizzes.count,
      averageScore: avgScore.avg ? Math.round(avgScore.avg) : 0,
      totalAttempts: totalAttempts.count,
      completedQuizIds: completedIds.map((r) => r.quiz_id),
    },
  })
})

quizzes.get('/admin/progress', authMiddleware, adminMiddleware, async (c) => {
  const snapshot = getGameSnapshot(c.get('user').userId)
  const totalQuizzesRow = db.prepare('SELECT COUNT(*) as count FROM quizzes').get() as { count: number }
  const quizStats = db.prepare(`
    SELECT
      u.id,
      u.email,
      COUNT(qa.id) as total_attempts,
      COUNT(DISTINCT qa.quiz_id) as completed_quizzes,
      AVG(CAST(qa.score AS FLOAT) / NULLIF(qa.total_questions, 0) * 100) as average_score,
      MAX(qa.submitted_at) as last_attempt
    FROM users u
    LEFT JOIN quiz_attempts qa ON qa.user_id = u.id
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY completed_quizzes DESC, average_score DESC, last_attempt DESC, u.email ASC
  `).all() as {
    id: number
    email: string
    total_attempts: number
    completed_quizzes: number
    average_score: number | null
    last_attempt: string | null
  }[]

  const leaderboardById = new Map(snapshot.leaderboard.map((student) => [student.id, student]))

  return c.json({
    students: quizStats.map((student) => {
      const game = leaderboardById.get(student.id)
      return {
        id: student.id,
        email: student.email,
        completedQuizzes: Number(student.completed_quizzes || 0),
        totalAttempts: Number(student.total_attempts || 0),
        averageScore: student.average_score ? Math.round(student.average_score) : 0,
        lastAttempt: student.last_attempt,
        currentStage: game?.currentStage ?? 1,
        bestStage: game?.bestStage ?? 0,
        totalStars: game?.totalStars ?? 0,
        totalRewards: game?.totalRewards ?? 0,
      }
    }),
    totalQuizzes: totalQuizzesRow.count,
    monthlyChampion: snapshot.monthlyChampion,
  })
})

quizzes.get('/admin/progress/:userId', authMiddleware, adminMiddleware, async (c) => {
  const userId = Number.parseInt(c.req.param('userId'), 10)

  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as { id: number; email: string } | undefined
  if (!user) {
    return c.json({ error: 'Not Found', message: 'User not found' }, 404)
  }

  const attempts = db.prepare(`
    SELECT
      qa.*,
      q.title as quiz_title,
      q.difficulty as quiz_difficulty
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    WHERE qa.user_id = ?
    ORDER BY qa.submitted_at DESC
  `).all(userId) as (DbQuizAttempt & { quiz_title: string; quiz_difficulty: string })[]

  const stageRows = db.prepare(`
    SELECT stage_number, stage_type, completed, stars_earned, reward_earned, updated_at
    FROM quiz_game_stage_progress
    WHERE user_id = ?
    ORDER BY stage_type, stage_number
  `).all(userId)

  const profile = ensureGameProfile(userId)

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      currentStage: profile.current_stage,
      bestStage: profile.best_stage,
      totalStars: profile.total_stars,
      totalRewards: profile.total_rewards,
    },
    stageProgress: stageRows,
    attempts: attempts.map((a) => ({
      id: a.id,
      quizId: a.quiz_id,
      quizTitle: a.quiz_title,
      quizDifficulty: a.quiz_difficulty,
      score: a.score,
      totalQuestions: a.total_questions,
      percentage: Math.round((a.score / a.total_questions) * 100),
      submittedAt: a.submitted_at,
    })),
  })
})

quizzes.get('/', async (c) => {
  const rows = db.prepare(`
    SELECT q.*, l.title as lecture_title
    FROM quizzes q
    LEFT JOIN lectures l ON q.lecture_id = l.id
    ORDER BY q.created_at DESC
  `).all() as DbQuiz[]

  return c.json({ quizzes: rows.map(mapQuiz) })
})

quizzes.get('/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const row = db.prepare(`
    SELECT q.*, l.title as lecture_title
    FROM quizzes q
    LEFT JOIN lectures l ON q.lecture_id = l.id
    WHERE q.id = ?
  `).get(id) as DbQuiz | undefined

  if (!row) {
    return c.json({ error: 'Not Found', message: 'Quiz not found' }, 404)
  }

  return c.json({ quiz: mapQuiz(row) })
})

quizzes.post('/', authMiddleware, adminMiddleware, async (c) => {
  const body = await c.req.json<CreateQuizRequest>()
  const { title, description, questions, difficulty, lectureId, fileUrl, fileName, fileType, fileSize } = body

  if (!title || !description || !questions || !Array.isArray(questions)) {
    return c.json({ error: 'Bad Request', message: 'Title, description, and questions are required' }, 400)
  }

  const result = db.prepare(`
    INSERT INTO quizzes (title, description, questions, difficulty, lecture_id, file_url, file_name, file_type, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description,
    JSON.stringify(questions),
    difficulty || 'medium',
    lectureId || null,
    fileUrl || null,
    fileName || null,
    fileType || null,
    fileSize ?? null,
  )

  const row = db.prepare(`
    SELECT q.*, l.title as lecture_title
    FROM quizzes q
    LEFT JOIN lectures l ON q.lecture_id = l.id
    WHERE q.id = ?
  `).get(result.lastInsertRowid) as DbQuiz

  return c.json({ quiz: mapQuiz(row), message: 'Quiz created successfully' }, 201)
})

quizzes.put('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const body = await c.req.json<Partial<CreateQuizRequest>>()
  const { title, description, questions, difficulty, lectureId, fileUrl, fileName, fileType, fileSize } = body

  const existing = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(id) as DbQuiz | undefined
  if (!existing) {
    return c.json({ error: 'Not Found', message: 'Quiz not found' }, 404)
  }

  db.prepare(`
    UPDATE quizzes
    SET title = ?, description = ?, questions = ?, difficulty = ?, lecture_id = ?, file_url = ?, file_name = ?, file_type = ?, file_size = ?
    WHERE id = ?
  `).run(
    title ?? existing.title,
    description ?? existing.description,
    questions ? JSON.stringify(questions) : existing.questions,
    difficulty ?? existing.difficulty,
    lectureId !== undefined ? lectureId : existing.lecture_id,
    fileUrl !== undefined ? fileUrl : existing.file_url,
    fileName !== undefined ? fileName : existing.file_name,
    fileType !== undefined ? fileType : existing.file_type,
    fileSize !== undefined ? fileSize : existing.file_size,
    id,
  )

  const row = db.prepare(`
    SELECT q.*, l.title as lecture_title
    FROM quizzes q
    LEFT JOIN lectures l ON q.lecture_id = l.id
    WHERE q.id = ?
  `).get(id) as DbQuiz

  return c.json({ quiz: mapQuiz(row), message: 'Quiz updated successfully' })
})

quizzes.delete('/:id', authMiddleware, adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const result = db.prepare('DELETE FROM quizzes WHERE id = ?').run(id)

  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Quiz not found' }, 404)
  }

  return c.json({ message: 'Quiz deleted successfully' })
})

quizzes.post('/:id/submit', authMiddleware, async (c) => {
  const quizId = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')
  const { answers } = await c.req.json<{ answers: Record<string, number> }>()

  const quizRow = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId) as DbQuiz | undefined
  if (!quizRow) {
    return c.json({ error: 'Not Found', message: 'Quiz not found' }, 404)
  }

  const questions = JSON.parse(quizRow.questions) as QuizQuestion[]
  let score = 0

  for (const question of questions) {
    const userAnswer = answers[question.id]
    if (userAnswer === question.correctAnswer) {
      score += 1
    }
  }

  const result = db.prepare(`
    INSERT INTO quiz_attempts (quiz_id, user_id, answers, score, total_questions)
    VALUES (?, ?, ?, ?, ?)
  `).run(quizId, user.userId, JSON.stringify(answers), score, questions.length)

  const row = db.prepare('SELECT * FROM quiz_attempts WHERE id = ?').get(result.lastInsertRowid) as DbQuizAttempt

  return c.json({
    attempt: mapAttempt(row),
    message: `Quiz completed! Score: ${score}/${questions.length}`,
  }, 201)
})

quizzes.get('/:id/attempts', authMiddleware, async (c) => {
  const quizId = Number.parseInt(c.req.param('id'), 10)
  const user = c.get('user')

  const rows = db.prepare(`
    SELECT * FROM quiz_attempts
    WHERE quiz_id = ? AND user_id = ?
    ORDER BY submitted_at DESC
  `).all(quizId, user.userId) as DbQuizAttempt[]

  return c.json({ attempts: rows.map(mapAttempt) })
})

export { quizzes }
