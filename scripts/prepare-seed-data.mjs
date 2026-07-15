import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(__dirname, '../apps/api')
const seedDir = path.join(apiDir, 'seed-data')
const uploadsSeedDir = path.join(seedDir, 'uploads')

fs.mkdirSync(uploadsSeedDir, { recursive: true })

const dbSource = path.join(apiDir, 'teaching-app.db')
const dbTarget = path.join(seedDir, 'teaching-app.db')

if (!fs.existsSync(dbSource)) {
  console.error('Missing apps/api/teaching-app.db — run the app locally first or copy your database.')
  process.exit(1)
}

fs.copyFileSync(dbSource, dbTarget)
console.log('Copied database -> seed-data/teaching-app.db')

const uploadsDir = path.join(apiDir, 'uploads')
let count = 0
for (const fileName of fs.readdirSync(uploadsDir)) {
  const source = path.join(uploadsDir, fileName)
  if (!fs.statSync(source).isFile()) continue
  fs.copyFileSync(source, path.join(uploadsSeedDir, fileName))
  count += 1
}

console.log(`Copied ${count} upload files -> seed-data/uploads/`)
