import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(__dirname, '../apps/api')
const dataDir = process.env.DATA_DIR || '/data'
const dbPath = process.env.DB_PATH || path.join(dataDir, 'teaching-app.db')
const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, 'uploads')
const seedUploadsDir = path.join(apiDir, 'uploads')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
fs.mkdirSync(uploadDir, { recursive: true })

if (fs.existsSync(seedUploadsDir)) {
  for (const fileName of fs.readdirSync(seedUploadsDir)) {
    const source = path.join(seedUploadsDir, fileName)
    const target = path.join(uploadDir, fileName)
    if (!fs.existsSync(target) && fs.statSync(source).isFile()) {
      fs.copyFileSync(source, target)
    }
  }
}

const env = {
  ...process.env,
  DB_PATH: dbPath,
  UPLOAD_DIR: uploadDir,
}

await new Promise((resolve, reject) => {
  const seed = spawn('npx', ['tsx', 'seed-admin.ts'], {
    cwd: apiDir,
    env,
    stdio: 'inherit',
    shell: true,
  })

  seed.on('close', (code) => {
    if (code === 0) resolve()
    else reject(new Error(`seed-admin.ts exited with code ${code}`))
  })
})

const server = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
  shell: true,
})

server.on('close', (code) => process.exit(code ?? 0))
