import { execSync } from 'node:child_process'
import process from 'node:process'

const ports = process.argv.slice(2).filter(Boolean)

if (ports.length === 0) {
  process.exit(0)
}

const isWindows = process.platform === 'win32'
const currentPid = String(process.pid)

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function freePortWindows(port) {
  let output = ''
  try {
    output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return
  }

  const pids = unique(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.includes('LISTENING'))
      .map((line) => line.split(/\s+/).pop())
      .filter((pid) => pid && pid !== currentPid)
  )

  for (const pid of pids) {
    try {
      console.log(`🧹 Closing old process on port ${port} (PID ${pid})`)
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    } catch {
      console.warn(`⚠️ Could not close PID ${pid} on port ${port}. Close it manually if the port stays busy.`)
    }
  }
}

function freePortUnix(port) {
  let output = ''
  try {
    output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return
  }

  const pids = unique(output.split(/\s+/).filter((pid) => pid && pid !== currentPid))

  for (const pid of pids) {
    try {
      console.log(`🧹 Closing old process on port ${port} (PID ${pid})`)
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
    } catch {
      console.warn(`⚠️ Could not close PID ${pid} on port ${port}. Close it manually if the port stays busy.`)
    }
  }
}

for (const port of ports) {
  if (!/^\d+$/.test(port)) continue
  if (isWindows) freePortWindows(port)
  else freePortUnix(port)
}
