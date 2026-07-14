import { Hono } from 'hono'
import { db } from '../db/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { wsManager } from '../lib/websocket.js'
import type { Resource, ResourceStats, ResourceType } from '@teaching-app/shared'

const resources = new Hono()

interface DbResource {
  id: number
  title: string
  type: ResourceType
  unit_name: string | null
  group_name: string | null
  student_count: number | null
  activity_count: number | null
  lab_name: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  description: string | null
  is_archived: number
  created_by: number
  created_at: string
}

const mapResource = (resource: DbResource): Resource => ({
  id: resource.id,
  title: resource.title,
  type: resource.type,
  unitName: resource.unit_name,
  groupName: resource.group_name,
  studentCount: resource.student_count ?? 0,
  activityCount: resource.activity_count ?? 0,
  labName: resource.lab_name,
  fileUrl: resource.file_url,
  fileName: resource.file_name,
  fileType: resource.file_type,
  fileSize: resource.file_size,
  description: resource.description,
  isArchived: Boolean(resource.is_archived),
  createdAt: resource.created_at,
  createdBy: resource.created_by,
})

resources.use('*', authMiddleware)

resources.get('/', (c) => {
  const search = c.req.query('search')?.trim() ?? ''
  const type = c.req.query('type')?.trim() ?? ''
  const includeArchived = c.req.query('includeArchived') === 'true'

  const where: string[] = []
  const params: unknown[] = []

  if (search) {
    where.push("(title LIKE ? OR IFNULL(unit_name, '') LIKE ? OR IFNULL(group_name, '') LIKE ? OR IFNULL(description, '') LIKE ?)")
    const value = `%${search}%`
    params.push(value, value, value, value)
  }

  if (type) {
    where.push('type = ?')
    params.push(type)
  }

  if (!includeArchived) {
    where.push('is_archived = 0')
  }

  const sql = `
    SELECT *
    FROM resources
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
  `

  const records = db.prepare(sql).all(...params) as DbResource[]
  return c.json({ resources: records.map(mapResource) })
})

resources.get('/stats', () => {
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total_resources,
      SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) AS active_resources,
      SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) AS archived_resources,
      COUNT(DISTINCT IFNULL(group_name, '')) AS total_groups,
      COALESCE(SUM(student_count), 0) AS total_students
    FROM resources
  `).get() as {
    total_resources: number | null
    active_resources: number | null
    archived_resources: number | null
    total_groups: number | null
    total_students: number | null
  }

  const stats: ResourceStats = {
    totalResources: totals.total_resources ?? 0,
    activeResources: totals.active_resources ?? 0,
    archivedResources: totals.archived_resources ?? 0,
    totalGroups: totals.total_groups ?? 0,
    totalStudents: totals.total_students ?? 0,
  }

  return new Response(JSON.stringify({ stats }), { headers: { 'Content-Type': 'application/json' } })
})

resources.post('/', adminMiddleware, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{
    title?: string
    type?: ResourceType
    unitName?: string
    groupName?: string
    studentCount?: number
    activityCount?: number
    labName?: string
    fileUrl?: string
    fileName?: string
    fileType?: string
    fileSize?: number
    description?: string
  }>()

  if (!body.title?.trim() || !body.type) {
    return c.json({ error: 'Bad Request', message: 'Title and type are required' }, 400)
  }

  const result = db.prepare(`
    INSERT INTO resources (
      title, type, unit_name, group_name, student_count, activity_count,
      lab_name, file_url, file_name, file_type, file_size, description, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.title.trim(),
    body.type,
    body.unitName?.trim() || null,
    body.groupName?.trim() || null,
    body.studentCount ?? 0,
    body.activityCount ?? 0,
    body.labName?.trim() || null,
    body.fileUrl?.trim() || null,
    body.fileName?.trim() || null,
    body.fileType?.trim() || null,
    body.fileSize ?? null,
    body.description?.trim() || null,
    user.userId,
  )

  const row = db.prepare('SELECT * FROM resources WHERE id = ?').get(result.lastInsertRowid) as DbResource
  const resource = mapResource(row)
  wsManager.broadcast({ type: 'resource:created', data: resource })
  return c.json({ resource, id: result.lastInsertRowid, message: 'Resource created successfully' }, 201)
})

resources.patch('/:id/archive', adminMiddleware, async (c) => {
  const id = Number.parseInt(c.req.param('id'), 10)
  const body = await c.req.json<{ isArchived?: boolean }>().catch(() => ({ isArchived: true }))
  const isArchived = body.isArchived ? 1 : 0

  const result = db.prepare('UPDATE resources SET is_archived = ? WHERE id = ?').run(isArchived, id)
  if (result.changes === 0) {
    return c.json({ error: 'Not Found', message: 'Resource not found' }, 404)
  }

  wsManager.broadcast({ type: 'resource:updated', data: { id, isArchived: Boolean(isArchived) } })
  return c.json({ message: isArchived ? 'Resource archived' : 'Resource restored' })
})

export { resources }
