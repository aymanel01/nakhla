import Database from 'better-sqlite3'

const db = new Database('teaching-app.db')

const user = db.prepare('SELECT email, role, status, email_verified FROM users WHERE email = ?').get('admin@app.com')

console.log('Admin user data:', user)

db.close()