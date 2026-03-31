/**
 * Batch seed image generation via OpenAI Images API.
 * Usage from repo root: node --env-file=.env scripts/generate-seed-image.mjs
 *
 * Requires OPENAI_API_KEY in .env (see .env.example).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Add or remove items here to generate them in a batch.
const ITEMS = [
  { id: 'ing-avocado', subject: 'a halved avocado showing the pit' },
  { id: 'ing-broccoli', subject: 'a single small head of fresh broccoli' },
  { id: 'ing-garlic', subject: 'a whole garlic bulb next to a single peeled clove' },
  { id: 'ing-lemon', subject: 'a whole yellow lemon next to a lemon half' },
  { id: 'ing-salmon', subject: 'a raw salmon fillet portion' },
]

const getPrompt = (subject) => [
  `A simple watercolor food illustration of ${subject}.`,
  'Hand-drawn watercolor ingredient study, light pencil outline with soft watercolor wash.',
  'Isolated illustrated food subject on a pure white background.',
  'Minimal cookbook-style spot art, delicate and clean, lots of negative space.',
  'Negative: no photorealism, no vector icon style, no heavy outlines, no cluttered background, no text, no props.',
].join(' ')

const key = process.env.OPENAI_API_KEY
if (!key?.trim()) {
  console.error('Missing OPENAI_API_KEY. Run: node --env-file=.env scripts/generate-seed-image.mjs')
  process.exit(1)
}

const dir = join(root, 'public/images/seed')
mkdirSync(dir, { recursive: true })

for (const item of ITEMS) {
  console.log(`Generating ${item.id}...`)
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: getPrompt(item.subject),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    console.error(`OpenAI API error for ${item.id}:`, JSON.stringify(data, null, 2))
    continue
  }

  const url = data.data?.[0]?.url
  if (!url) {
    console.error(`Unexpected response for ${item.id}:`, data)
    continue
  }

  const imgRes = await fetch(url)
  if (!imgRes.ok) {
    console.error(`Failed to download image for ${item.id}:`, imgRes.status)
    continue
  }

  const buf = Buffer.from(await imgRes.arrayBuffer())
  const outPath = join(dir, `${item.id}.png`)
  writeFileSync(outPath, buf)
  console.log(`Wrote ${outPath}`)
  
  // Wait a moment between requests to respect rate limits
  await new Promise(resolve => setTimeout(resolve, 2000))
}
