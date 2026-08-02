import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(__dirname, '../apps/api')
const seedDataDir = path.join(apiDir, 'seed-data')
const dataDir = process.env.DATA_DIR || '/app/data'
const dbPath = process.env.DB_PATH || path.join(dataDir, 'teaching-app.db')
const uploadDir = process.env.UPLOAD_DIR || path.join(dataDir, 'uploads')
const seedUploadsDir = path.join(apiDir, 'uploads')
const restoreSeedData = process.env.RESTORE_SEED_DATA === 'true'

fs.mkdirSync(path.dirname(dbPath), { recursive: true })
fs.mkdirSync(uploadDir, { recursive: true })

function copyDir(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) return 0
  let copied = 0
  for (const fileName of fs.readdirSync(sourceDir)) {
    const source = path.join(sourceDir, fileName)
    const target = path.join(targetDir, fileName)
    if (!fs.statSync(source).isFile()) continue
    if (!fs.existsSync(target)) {
      fs.copyFileSync(source, target)
      copied += 1
    }
  }
  return copied
}

const seedDb = path.join(seedDataDir, 'teaching-app.db')
const shouldRestoreDb =
  fs.existsSync(seedDb) && (restoreSeedData || !fs.existsSync(dbPath))
if (shouldRestoreDb) {
  fs.copyFileSync(seedDb, dbPath)
  console.log('Restored database from seed-data/teaching-app.db')
}

copyDir(path.join(seedDataDir, 'uploads'), uploadDir)
copyDir(seedUploadsDir, uploadDir)

const env = {
  ...process.env,
  DB_PATH: dbPath,
  UPLOAD_DIR: uploadDir,
}

async function runSeed(command, args, optional = false) {
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: apiDir,
        env,
        stdio: 'inherit',
        shell: true,
      })
      child.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`${args.join(' ')} exited with code ${code}`))
      })
    })
  } catch (error) {
    if (optional) {
      console.warn(`Optional seed skipped: ${error instanceof Error ? error.message : error}`)
      return
    }
    throw error
  }
}

await runSeed('npx', ['tsx', 'init-db.ts'])
await runSeed('npx', ['tsx', 'seed-admin.ts'])
await runSeed('npx', ['tsx', 'seed-students.ts'])
await runSeed('node', ['seed-map-quiz.mjs'], true)
await runSeed('node', ['seed-writing-lesson.mjs'], true)

const server = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: apiDir,
  env,
  stdio: 'inherit',
  shell: true,
})

server.on('close', (code) => process.exit(code ?? 0))
