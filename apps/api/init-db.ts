import Database from 'better-sqlite3'
import { initializeDatabase } from './src/db/schema.js'

const dbPath = process.env.DB_PATH || 'teaching-app.db'
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
initializeDatabase(db)
db.close()
console.log('Database schema initialized')
