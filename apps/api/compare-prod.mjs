import Database from 'better-sqlite3'
import fs from 'node:fs'

const local = new Database('teaching-app.db')
const localRows = local.prepare('SELECT category, length(content) len, file_url FROM admin_section_posts WHERE section = ? ORDER BY category').all('social-economic')
local.close()

const login = await fetch('https://nakhla.fly.dev/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@app.com', password: 'Nakhla2026!' }),
})
const cookie = login.headers.getSetCookie?.() || []
const cookieHeader = cookie.map((c) => c.split(';')[0]).join('; ')

const res = await fetch('https://nakhla.fly.dev/api/admin/content/social-economic', {
  headers: { Cookie: cookieHeader },
})
const { posts: prodRows } = await res.json()
const prodMap = Object.fromEntries(prodRows.map((p) => [p.category, p]))

let diffs = 0
for (const l of localRows) {
  const p = prodMap[l.category]
  if (!p) {
    console.log('MISSING ON PROD:', l.category)
    diffs++
    continue
  }
  const plen = (p.content || '').length
  if (l.len !== plen) {
    console.log('LEN DIFF:', l.category, 'local', l.len, 'prod', plen)
    diffs++
  }
  if ((l.file_url || '') !== (p.fileUrl || '')) {
    console.log('FILE DIFF:', l.category)
    diffs++
  }
}

for (const p of prodRows) {
  if (!localRows.find((l) => l.category === p.category)) {
    console.log('EXTRA ON PROD:', p.category)
    diffs++
  }
}

console.log('diffs:', diffs)
