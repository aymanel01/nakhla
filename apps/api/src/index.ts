import { serve } from '@hono/node-server'
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

const app = new Hono()

app.use('*', logger())
function isAllowedOrigin(origin: string) {
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
    /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)
  )
}

app.use(
  '*',
  cors({
    origin: (origin) => (origin && isAllowedOrigin(origin) ? origin : 'http://localhost:5173'),
    credentials: true,
  })
)

app.get('/', (c) => {
  return c.json({ message: 'Teaching App API', version: '1.0.0' })
})

app.route('/auth', auth)
app.route('/admin/users', users)
app.route('/lectures', lectures)
app.route('/exercises', exercises)
app.route('/quizzes', quizzes)
app.route('/homework', homework)
app.route('/messages', messages)
app.route('/groups', groups)
app.route('/resources', resources)
app.route('/uploads', uploads)
app.route('/progress', progress)
app.route('/admin/content', adminContent)
app.route('/student-creations', studentCreations)

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

app.get('/files/:name', authMiddleware, async (c) => {
  const fileName = c.req.param('name')
  const filePath = path.join(uploadDir, fileName)

  try {
    const file = await fs.readFile(filePath)
    const extension = path.extname(fileName).toLowerCase()
    const contentType = MIME_TYPES[extension] || 'application/octet-stream'
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        // Let the browser render the file in-place (iframe/img/video) instead of forcing a download.
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch {
    return c.json({ error: 'Not Found', message: 'File not found' }, 404)
  }
})

const port = Number.parseInt(process.env.PORT || '3000', 10)

const server = serve({
  fetch: app.fetch,
  port,
})

// @ts-expect-error Type mismatch between Hono server and ws expected server type
wsManager.initialize(server)

console.log(`🚀 Server running at http://localhost:${port}`)
