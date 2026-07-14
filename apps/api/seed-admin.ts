import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import path from 'node:path'
import { initializeDatabase } from './src/db/schema.js'

const dbPath = process.env.DB_PATH || path.resolve('teaching-app.db')
const email = process.env.ADMIN_EMAIL || 'admin@app.com'
const password = process.env.ADMIN_PASSWORD || '12345678'

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
initializeDatabase(db)

const passwordHash = await bcrypt.hash(password, 12)
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)

if (existing) {
  db.prepare(
    "UPDATE users SET role = 'admin', full_name = COALESCE(NULLIF(full_name, ''), 'Admin'), status = 'approved', email_verified = 1, password_hash = ? WHERE email = ?"
  ).run(passwordHash, email)
  console.log(`Updated admin user: ${email}`)
} else {
  db.prepare(
    "INSERT INTO users (email, full_name, password_hash, role, status, email_verified) VALUES (?, 'Admin', ?, 'admin', 'approved', 1)"
  ).run(email, passwordHash)
  console.log(`Created admin user: ${email}`)
}

db.close()
