/**
 * One-off / repeatable seed image generation via OpenAI Images API.
 * Usage from repo root: node --env-file=.env scripts/generate-seed-image.mjs
 *
 * Requires OPENAI_API_KEY in .env (see .env.example).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const PROMPT = [
  'A simple watercolor food illustration of a halved avocado showing the pit.',
  'Hand-drawn watercolor ingredient study, light pencil outline with soft green and brown watercolor wash.',
  'Isolated illustrated food subject on a pure white background.',
  'Minimal cookbook-style spot art, delicate and clean, lots of negative space.',
  'Negative: no photorealism, no vector icon style, no heavy outlines, no cluttered background, no text, no props.',
].join(' ')

const key = process.env.OPENAI_API_KEY
if (!key?.trim()) {
  console.error('Missing OPENAI_API_KEY. Run: node --env-file=.env scripts/generate-seed-image.mjs')
  process.exit(1)
}

const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'dall-e-3',
    prompt: PROMPT,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  }),
})

const data = await res.json()
if (!res.ok) {
  console.error('OpenAI API error:', JSON.stringify(data, null, 2))
  process.exit(1)
}

const url = data.data?.[0]?.url
if (!url) {
  console.error('Unexpected response:', data)
  process.exit(1)
}

const imgRes = await fetch(url)
if (!imgRes.ok) {
  console.error('Failed to download image:', imgRes.status)
  process.exit(1)
}

const buf = Buffer.from(await imgRes.arrayBuffer())
const dir = join(root, 'public/images/seed')
mkdirSync(dir, { recursive: true })
const outPath = join(dir, 'ing-avocado.png')
writeFileSync(outPath, buf)
console.log('Wrote', outPath)
