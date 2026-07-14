import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import path from 'node:path'
import { initializeDatabase } from './schema.js'

const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'teaching-app.db')
const db: DatabaseType = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

initializeDatabase(db)

export { db }
