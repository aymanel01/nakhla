const email = process.env.PROD_EMAIL || 'elharouni@nakhla.com'
const password = process.env.PROD_PASSWORD || 'Nakhla2026!'
const base = process.env.PROD_URL || 'https://nakhla.fly.dev'

const login = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
if (!login.ok) {
  console.error('Login failed', login.status)
  process.exit(1)
}
const cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ')
const headers = { Cookie: cookie }

const refs = new Set()
function collect(text) {
  if (!text) return
  for (const match of text.matchAll(/\/api\/files\/([^"'`\s]+)/g)) refs.add(match[1])
}

const postsRes = await fetch(`${base}/api/admin/content/social-economic`, { headers })
const { posts } = await postsRes.json()
for (const post of posts) {
  collect(post.content)
  collect(post.fileUrl)
}

const lecturesRes = await fetch(`${base}/api/lectures`, { headers })
const { lectures } = await lecturesRes.json()
for (const lecture of lectures) collect(lecture.fileUrl)

let missing = 0
for (const name of refs) {
  const fileRes = await fetch(`${base}/api/files/${encodeURIComponent(name)}`, { headers })
  if (fileRes.status !== 200) {
    console.log('MISSING', fileRes.status, name)
    missing++
  }
}

console.log('file refs:', refs.size)
console.log('missing on prod:', missing)
