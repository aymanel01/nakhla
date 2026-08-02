import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const db = new Database('teaching-app.db')
const uploadDir = path.resolve('uploads')
const refs = new Set()

function collect(text) {
  if (!text) return
  for (const match of text.matchAll(/\/api\/files\/([^"'`\s]+)/g)) refs.add(match[1])
}

for (const row of db.prepare('SELECT content, file_url FROM admin_section_posts').all()) {
  collect(row.content)
  collect(row.file_url)
}
for (const row of db.prepare('SELECT file_url FROM lectures').all()) collect(row.file_url)
for (const row of db.prepare('SELECT file_url, thumbnail_url FROM student_creations').all()) {
  collect(row.file_url)
  collect(row.thumbnail_url)
}
for (const row of db.prepare('SELECT file_url FROM resources').all()) collect(row.file_url)

const required = [...refs].sort()
const missingLocal = required.filter((name) => !fs.existsSync(path.join(uploadDir, name)))
console.log('required', required.length)
console.log('missing_local', missingLocal.length)
for (const name of required) console.log(name)

db.close()
