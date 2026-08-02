import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const uploadDir = path.resolve('uploads')
const prodListing = fs.readFileSync('prod-uploads.txt', 'utf8')
const prodFiles = new Set(prodListing.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
const localFiles = fs.readdirSync(uploadDir).filter((f) => fs.statSync(path.join(uploadDir, f)).isFile())
const missing = localFiles.filter((f) => !prodFiles.has(f)).sort()

console.log('missing count', missing.length)
for (const file of missing) console.log(file)

const fly = process.env.FLYCTL || 'flyctl'
let failed = 0
for (const file of missing) {
  const localPath = path.join(uploadDir, file)
  const remotePath = `/data/uploads/${file}`
  const result = spawnSync(fly, ['ssh', 'sftp', 'put', localPath, remotePath, '--app', 'nakhla', '-q'], {
    stdio: 'inherit',
    shell: true,
  })
  if (result.status !== 0) {
    console.error('FAILED', file)
    failed++
  } else {
    console.log('OK', file)
  }
}
process.exit(failed > 0 ? 1 : 0)
