import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { initializeDatabase } from './schema.js'

const db: DatabaseType = new Database('teaching-app.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

initializeDatabase(db)

export { db }
