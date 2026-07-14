import { Hono } from 'hono'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { db } from '../db/index.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const uploads = new Hono()
const uploadDir = path.resolve(process.cwd(), 'uploads')

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

async function saveUploadedFile(file: File) {
  await fs.mkdir(uploadDir, { recursive: true })
  const extension = path.extname(file.name || '')
  const baseName = path.basename(file.name || 'file', extension)
  const finalName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(baseName)}${extension}`
  const filePath = path.join(uploadDir, finalName)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(filePath, buffer)

  return {
    fileUrl: `/api/files/${finalName}`,
    fileName: file.name || finalName,
    fileType: file.type || null,
    fileSize: file.size || buffer.length,
  }
}

uploads.use('*', authMiddleware)

uploads.post('/chat', async (c) => {
  const user = c.get('user')
  const settings = db.prepare('SELECT users_can_send FROM chat_settings WHERE id = 1').get() as { users_can_send: number } | undefined

  if (user.role !== 'admin' && !Boolean(settings?.users_can_send)) {
    return c.json({ error: 'Forbidden', message: 'Chat is closed by admin' }, 403)
  }

  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json({ error: 'Bad Request', message: 'File is required' }, 400)
  }
  if (file.size === 0) {
    return c.json({ error: 'Bad Request', message: 'File is empty' }, 400)
  }

  const uploaded = await saveUploadedFile(file)
  return c.json({ file: uploaded }, 201)
})


uploads.post('/profile', async (c) => {
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json({ error: 'Bad Request', message: 'File is required' }, 400)
  }
  if (file.size === 0) {
    return c.json({ error: 'Bad Request', message: 'File is empty' }, 400)
  }
  if (file.type && !file.type.startsWith('image/')) {
    return c.json({ error: 'Bad Request', message: 'Profile picture must be an image' }, 400)
  }

  const uploaded = await saveUploadedFile(file)
  return c.json({ file: uploaded }, 201)
})

uploads.post('/submission', async (c) => {
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json({ error: 'Bad Request', message: 'File is required' }, 400)
  }
  if (file.size === 0) {
    return c.json({ error: 'Bad Request', message: 'File is empty' }, 400)
  }

  const uploaded = await saveUploadedFile(file)
  return c.json({ file: uploaded }, 201)
})

uploads.post('/admin', adminMiddleware, async (c) => {
  const body = await c.req.parseBody()
  const file = body.file
  if (!(file instanceof File)) {
    return c.json({ error: 'Bad Request', message: 'File is required' }, 400)
  }
  if (file.size === 0) {
    return c.json({ error: 'Bad Request', message: 'File is empty' }, 400)
  }

  const uploaded = await saveUploadedFile(file)
  return c.json({ file: uploaded }, 201)
})

export { uploads, uploadDir }
