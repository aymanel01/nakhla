import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import { buildSearchIndex } from '../lib/search-index.js'

const search = new Hono()

search.use('*', authMiddleware)

search.get('/index', (c) => {
  return c.json({ items: buildSearchIndex() })
})

export { search }
