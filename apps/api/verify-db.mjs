import Database from 'better-sqlite3'

const db = new Database('teaching-app.db')

try {
  const user = db.prepare('SELECT id, email, role, status, email_verified FROM users WHERE email = ?').get('admin@app.com')
  
  console.log('Admin user found:')
  console.log(user)
  console.log('\n✅ Admin account is ready!')
  console.log('Email: admin@app.com')
  console.log('Password: 12345678')
} catch (error) {
  console.error('Error:', error.message)
} finally {
  db.close()
}