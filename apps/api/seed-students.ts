import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import path from 'node:path'
import { initializeDatabase } from './src/db/schema.js'

const dbPath = process.env.DB_PATH || path.resolve('teaching-app.db')
const password = process.env.STUDENT_PASSWORD || '12345678'

const students = [
  { fullName: 'Ismaili', email: 'ismaili@nakhla.com' },
  { fullName: 'Bassma', email: 'bassma@nakhla.com' },
  { fullName: 'Khadija', email: 'khadija@nakhla.com' },
  { fullName: 'Rihab', email: 'rihab@nakhla.com' },
  { fullName: 'Salma', email: 'salma@nakhla.com' },
  { fullName: 'Souhail', email: 'souhail@nakhla.com' },
  { fullName: 'Marwa', email: 'marwa@nakhla.com' },
  { fullName: 'Hajar', email: 'hajar@nakhla.com' },
  { fullName: 'Wiam', email: 'wiam@nakhla.com' },
  { fullName: 'Farah', email: 'farah@nakhla.com' },
  { fullName: 'Dr. Dagigi', email: 'dr.dagigi@nakhla.com' },
]

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
initializeDatabase(db)

const passwordHash = await bcrypt.hash(password, 12)

const existingStmt = db.prepare('SELECT id FROM users WHERE email = ?')
const insertStmt = db.prepare(
  "INSERT INTO users (email, full_name, password_hash, role, status, email_verified) VALUES (?, ?, ?, 'user', 'approved', 1)"
)
const updateStmt = db.prepare(
  "UPDATE users SET full_name = ?, password_hash = ?, role = 'user', status = 'approved', email_verified = 1 WHERE email = ?"
)

for (const student of students) {
  const existing = existingStmt.get(student.email)
  if (existing) {
    updateStmt.run(student.fullName, passwordHash, student.email)
    console.log(`Updated: ${student.email}`)
  } else {
    insertStmt.run(student.email, student.fullName, passwordHash)
    console.log(`Created: ${student.email}`)
  }
}

console.log(`\nSeeded ${students.length} student accounts.`)
db.close()
