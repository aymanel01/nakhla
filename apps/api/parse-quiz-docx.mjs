import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const docx = path.resolve('../../الموارد/ابواب القصر/اسئلة القصر.docx')
const tmp = path.join(os.tmpdir(), 'quiz-docx-node')
const zip = path.join(os.tmpdir(), 'quiz-docx-node.zip')

fs.mkdirSync(tmp, { recursive: true })
fs.copyFileSync(docx, zip)

execFileSync(
  'powershell',
  ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force`],
  { stdio: 'pipe' },
)

const xml = fs.readFileSync(path.join(tmp, 'word', 'document.xml'), 'utf8')
let text = xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t')
text = text.replace(/<[^>]+>/g, '')
text = text
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')

const lines = text
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const out = path.resolve('quiz-docx-parsed.txt')
fs.writeFileSync(out, lines.join('\n'), 'utf8')
console.log(`Wrote ${lines.length} lines to ${out}`)
console.log(lines.join('\n'))
