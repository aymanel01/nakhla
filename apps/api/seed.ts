import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'

const db = new Database('teaching-app.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const email = 'admin@app.com'
const password = '12345678'
const role = 'admin'
const fullName = 'Admin'
const status = 'approved'
const emailVerified = 1

async function seedAdmin() {
  const passwordHash = await bcrypt.hash(password, 12)

  // Check if user exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)

  if (existing) {
    db.prepare("UPDATE users SET role = ?, full_name = COALESCE(NULLIF(full_name, ''), ?), status = ?, email_verified = ?, password_hash = ? WHERE email = ?").run(role, fullName, status, emailVerified, passwordHash, email)
    console.log(`✅ Updated ${email} to admin role`)
  } else {
    db.prepare('INSERT INTO users (email, full_name, password_hash, role, status, email_verified) VALUES (?, ?, ?, ?, ?, ?)').run(
      email,
      fullName,
      passwordHash,
      role,
      status,
      emailVerified
    )
    console.log(`✅ Created admin user: ${email}`)
  }

  db.close()
}

seedAdmin()
