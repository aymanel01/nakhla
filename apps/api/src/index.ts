import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { auth } from './routes/auth.js'
import { users } from './routes/users.js'
import { lectures } from './routes/lectures.js'
import { exercises } from './routes/exercises.js'
import { quizzes } from './routes/quizzes.js'
import { homework } from './routes/homework.js'
import { messages } from './routes/messages.js'
import { groups } from './routes/groups.js'
import { resources } from './routes/resources.js'
import { uploads, uploadDir } from './routes/uploads.js'
import { progress } from './routes/progress.js'
import { adminContent } from './routes/admin-content.js'
import { studentCreations } from './routes/student-creations.js'
import { authMiddleware } from './middleware/auth.js'
import { wsManager } from './lib/websocket.js'
import fs from 'node:fs/promises'
import path from 'node:path'

const isProduction = process.env.NODE_ENV === 'production'
const webDist = process.env.WEB_DIST
  ? path.resolve(process.env.WEB_DIST)
  : path.resolve(process.cwd(), '../web/dist')

const app = new Hono()

app.use('*', logger())

function isAllowedOrigin(origin: string) {
  const configured = (process.env.WEB_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (configured.includes(origin)) return true

  return (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin) ||
    (isProduction && /^https:\/\/[\w-]+\.fly\.dev$/.test(origin))
  )
}

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return isProduction ? '' : 'http://localhost:5173'
      return isAllowedOrigin(origin) ? origin : isProduction ? '' : 'http://localhost:5173'
    },
    credentials: true,
  })
)

const api = new Hono()

api.get('/', (c) => {
  return c.json({ message: 'Teaching App API', version: '1.0.0' })
})

api.route('/auth', auth)
api.route('/admin/users', users)
api.route('/lectures', lectures)
api.route('/exercises', exercises)
api.route('/quizzes', quizzes)
api.route('/homework', homework)
api.route('/messages', messages)
api.route('/groups', groups)
api.route('/resources', resources)
api.route('/uploads', uploads)
api.route('/progress', progress)
api.route('/admin/content', adminContent)
api.route('/student-creations', studentCreations)

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.srt': 'text/plain; charset=utf-8',
  '.vtt': 'text/vtt; charset=utf-8',
  '.rtf': 'application/rtf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
}

api.get('/files/:name', authMiddleware, async (c) => {
  const fileName = c.req.param('name')
  const filePath = path.join(uploadDir, fileName)

  try {
    const file = await fs.readFile(filePath)
    const extension = path.extname(fileName).toLowerCase()
    const contentType = MIME_TYPES[extension] || 'application/octet-stream'
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return c.json({ error: 'Not Found', message: 'File not found' }, 404)
  }
})

app.route('/api', api)

if (isProduction) {
  app.use('/assets/*', serveStatic({ root: webDist }))
  app.use('/*', serveStatic({ root: webDist }))
  app.get('*', serveStatic({ root: webDist, path: 'index.html' }))
}

const port = Number.parseInt(process.env.PORT || '3000', 10)

const server = serve({
  fetch: app.fetch,
  port,
})

// @ts-expect-error Type mismatch between Hono server and ws expected server type
wsManager.initialize(server)

console.log(`🚀 Server running at http://localhost:${port}`)
