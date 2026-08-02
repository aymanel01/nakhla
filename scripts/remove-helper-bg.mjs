import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const input = path.join(root, 'apps/web/public/branding/nakhla-helper.png')
const output = path.join(root, 'apps/web/public/branding/nakhla-helper-cutout.png')

const THRESHOLD = 248

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += 4) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const nearWhite = r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD
  const softEdge = r >= 230 && g >= 230 && b >= 230
  if (nearWhite) {
    data[i + 3] = 0
  } else if (softEdge) {
    const avg = (r + g + b) / 3
    data[i + 3] = Math.round(Math.max(0, Math.min(255, (248 - avg) * 12)))
  }
}

await sharp(data, { raw: info }).png().toFile(output)
console.log('Saved transparent helper:', output)
