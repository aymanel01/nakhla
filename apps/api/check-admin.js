const Database = require('better-sqlite3')
const db = new Database('teaching-app.db')

const user = db.prepare('SELECT id, email, role, status, email_verified, password_hash FROM users WHERE email = ?').get('admin@app.com')

console.log('Admin user in database:')
console.log(JSON.stringify(user, null, 2))

if (user) {
  console.log('\n✅ Admin user exists')
  console.log('Role:', user.role)
  console.log('Status:', user.status)
  console.log('Email verified:', user.email_verified)
} else {
  console.log('\n❌ Admin user NOT found in database!')
}

db.close()