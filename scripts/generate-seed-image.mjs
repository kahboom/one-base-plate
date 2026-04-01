/**
 * Batch seed image generation via OpenAI Images API.
 * Usage from repo root: node --env-file=.env scripts/generate-seed-image.mjs
 * Optional: pass one or more seed ids to generate only those images, e.g. .../generate-seed-image.mjs ing-bacon ing-banana
 *
 * Requires OPENAI_API_KEY in .env (see .env.example).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// Add or remove items here to generate them in a batch.
// Set `dish: true` for plated / prepared foods (softer “no props” negative).
const ITEMS = [
  { id: 'ing-chicken', subject: 'a raw boneless skinless chicken breast' },
  { id: 'ing-italian-sausage', subject: 'two raw italian sausage links' },
  {
    id: 'ing-chipolatas',
    subject:
      'a few slender uncooked chipolata sausages in a loose row, thin pale-pink links, no packaging',
  },
  { id: 'ing-carrots', subject: 'three whole carrots with trimmed green tops' },
  {
    id: 'rec-spaghetti-bolognese',
    subject:
      'a simple bowl of spaghetti with meat bolognese sauce, readable and unfussy',
    dish: true,
  },
  {
    id: 'rec-tray-pizza',
    subject:
      'a rectangular tray-baked pizza with tomato sauce, melted mozzarella, and a few fresh basil leaves, golden crust, one cohesive pie',
    dish: true,
  },
  {
    id: 'rec-taco-chicken',
    subject:
      'grilled chicken breast sliced into strips with light char marks, seasoned and unfussy, simple white plate',
    dish: true,
  },
  {
    id: 'rec-black-bean-filling',
    subject:
      'a shallow bowl of partly mashed black beans in rich dark sauce with visible whole beans, simple rustic taco filling',
    dish: true,
  },
  {
    id: 'rec-yogurt-lime-sauce',
    subject:
      'a small bowl of creamy white yogurt sauce with a wedge of lime and a few fresh cilantro leaves on the side, simple and clean',
    dish: true,
  },
  {
    id: 'rec-pizza-dough',
    subject:
      'two smooth risen pizza dough balls resting in a simple wide ceramic bowl, soft pale dough, light oil sheen, no flour explosion',
    dish: true,
  },
  {
    id: 'rec-pizza-sauce',
    subject:
      'a simple bowl of thick red tomato pizza sauce with a few visible herb flecks, smooth and appetizing',
    dish: true,
  },
  {
    id: 'rec-pasta-bake-sauce',
    subject:
      'a saucepan of simmering chunky tomato pasta sauce with onion and herbs, rich red, readable and unfussy',
    dish: true,
  },
  {
    id: 'rec-roasted-broccoli',
    subject:
      'roasted broccoli florets with crispy browned tips on a simple white plate, light garlic visible, unfussy',
    dish: true,
  },
  {
    id: 'rec-seasoned-rice',
    subject:
      'a simple bowl of fluffy cooked white rice with a light gloss from oil, plain and minimal',
    dish: true,
  },
  {
    id: 'rec-cheese-sauce',
    subject:
      'a small saucepan of smooth pale yellow cheese sauce, creamy and thick, simple presentation',
    dish: true,
  },
  {
    id: 'rec-tomato-soup',
    subject:
      'a bowl of smooth orange-red tomato soup with a gentle swirl, simple and warm, no garnish clutter',
    dish: true,
  },
  {
    id: 'bm-pasta-chicken',
    subject:
      'a simple bowl of penne pasta with grilled chicken strips, broccoli florets, and tomato sauce, one cohesive family dinner plate',
    dish: true,
  },
  {
    id: 'bm-salmon-rice',
    subject:
      'a simple plate with a pan-seared salmon fillet, fluffy white rice, and bright green peas, clearly separated, unfussy',
    dish: true,
  },
  {
    id: 'bm-fishfingers',
    subject:
      'a kid-friendly plate with golden fish fingers, a small pool of baked beans in tomato sauce, and two triangles of buttered toast',
    dish: true,
  },
  {
    id: 'bm-taco-night',
    subject:
      'three soft corn tacos on a simple plate with visible fillings of seasoned meat, lettuce shreds, and a dollop of white crema, casual family taco night',
    dish: true,
  },
  {
    id: 'bm-pizza-night',
    subject:
      'a baked round pizza with tomato sauce and melted mozzarella, one slice slightly pulled for depth, golden crust, clearly finished pizza not raw dough',
    dish: true,
  },
  {
    id: 'bm-pasta-bake',
    subject:
      'a shallow baking dish of pasta bake with red sauce, visible penne, and a golden bubbly cheese crust on top',
    dish: true,
  },
  {
    id: 'bm-rice-bowl',
    subject:
      'a rice bowl with white rice, sliced grilled chicken, and roasted broccoli florets arranged in gentle sections, light soy drizzle implied, simple bowl meal',
    dish: true,
  },
  {
    id: 'bm-rescue-cheesy-pasta',
    subject:
      'a comforting bowl of elbow macaroni coated in smooth pale yellow cheese sauce, creamy and simple, mac-and-cheese style rescue meal',
    dish: true,
  },
  { id: 'ing-cheddar', subject: 'a wedge of orange cheddar cheese' },
  { id: 'ing-paneer', subject: 'a rectangular block of white paneer cheese' },
  { id: 'ing-halloumi', subject: 'a few golden-brown grilled halloumi slices' },
  {
    id: 'ing-corn-tortillas',
    subject:
      'a short stack of four round yellow corn tortillas, soft and pliable, edges slightly uneven',
  },
  {
    id: 'ing-blueberries',
    subject: 'a loose small pile of fresh blueberries, dusty blue-purple, natural variation in size',
  },
  {
    id: 'ing-banana',
    subject: 'one whole ripe yellow banana with a hint of green at the stem, gentle curve',
  },
  {
    id: 'ing-bacon',
    subject:
      'several raw streaky bacon rashers, pink meat and creamy white fat marbling, uncooked',
  },
  {
    id: 'ing-beans',
    subject:
      'a small shallow bowl of baked beans in rich tomato sauce, simple and unfussy, steam implied but subtle',
    dish: true,
  },
  {
    id: 'ing-baguette',
    subject:
      'one classic French baguette with a golden scored crust, simple diagonal three-quarter view, no basket',
  },
  {
    id: 'ing-apple',
    subject: 'one whole apple with a short stem, subtle red blush over yellow-green skin, natural dimples',
  },
  {
    id: 'ing-eggs',
    subject: 'three whole brown chicken eggs in a loose gentle cluster, natural size variation, no carton',
  },
  {
    id: 'ing-flour',
    subject:
      'a neat textured mound of white flour in a simple shallow ceramic bowl, soft shadow inside the bowl only',
  },
  {
    id: 'ing-butter',
    subject:
      'a small rectangular block of pale yellow butter with soft hand-cut edges, no wrapper or packaging',
  },
  {
    id: 'ing-potatoes',
    subject: 'three whole brown baking potatoes with slight earthy skin variation, simple grouping',
  },
  {
    id: 'ing-sirloin-steak',
    subject:
      'one raw sirloin steak with light marbling, simple three-quarter view, no grill marks',
  },
  {
    id: 'ing-pita-bread',
    subject: 'two round soft pita breads, slightly puffed, pale golden, stacked loosely',
  },
  {
    id: 'ing-spinach',
    subject: 'a loose bunch of fresh spinach leaves with short stems, deep green, unfussy',
  },
  {
    id: 'ing-strawberries',
    subject:
      'a small loose cluster of ripe red strawberries with green leafy caps, natural size variation',
  },
  {
    id: 'ing-tinned-tomatoes',
    subject:
      'one plain unlabeled metal tin of chopped tomatoes in rich red juice, simple side view, no readable text or branding',
  },
  {
    id: 'ing-hummus',
    subject:
      'a small shallow bowl of creamy chickpea hummus with a gentle swirl on top and a light dusting of paprika, simple presentation',
    dish: true,
  },
  {
    id: 'ing-bread',
    subject:
      'one whole UK-style white tin loaf with a split top along the center, soft pale crust, uncut, simple three-quarter view, no basket',
  },
  {
    id: 'ing-onion',
    subject: 'one whole brown cooking onion with dry papery skin and a short root end',
  },
  {
    id: 'ing-oats',
    subject:
      'a neat textured mound of rolled oats in a simple shallow ceramic bowl, soft shadow inside the bowl only',
  },
  {
    id: 'ing-noodles',
    subject:
      'a loose bundle of dry uncooked wheat egg noodles, pale golden strands, slightly uneven lengths',
  },
  {
    id: 'ing-fishfingers',
    subject:
      'several golden breaded fish fingers in a simple loose row, crisp crumb coating, no packaging or tray',
  },
  {
    id: 'ing-milk',
    subject:
      'a simple ceramic milk jug about three-quarters full of white milk, small plain jug with no label or branding',
  },
  {
    id: 'ing-plum-tomatoes',
    subject:
      'a few whole ripe red plum tomatoes, oval Roma shape, natural size variation, one gently turned to show form, no vine clutter',
  },
  {
    id: 'ing-pasta',
    subject:
      'a neat loose bundle of dry uncooked spaghetti, long thin golden strands, naturally grouped, no packaging',
  },
  {
    id: 'ing-sugar',
    subject:
      'a neat mound of white granulated sugar in a simple shallow ceramic bowl, soft shadow inside the bowl only',
  },
  {
    id: 'ing-sourdough-bread',
    subject:
      'one round sourdough boule with a deep scored ear and rustic golden-brown crust, uncut, simple three-quarter view, no basket',
  },
  {
    id: 'ing-rice',
    subject:
      'a neat mound of dry uncooked white long-grain rice in a simple shallow ceramic bowl, soft shadow inside the bowl only',
  },
  {
    id: 'ing-yogurt',
    subject:
      'a small shallow bowl of thick plain white yogurt with a gentle smooth surface, no fruit, no branding',
    dish: true,
  },
  {
    id: 'ing-asparagus',
    subject:
      'a small tidy bundle of fresh green asparagus spears with trimmed pale ends, loosely grouped, no packaging',
  },
  {
    id: 'ing-aubergine',
    subject:
      'one whole glossy deep-purple aubergine eggplant, smooth skin, simple three-quarter view, uncut',
  },
  {
    id: 'ing-black-beans',
    subject:
      'a shallow bowl of dry uncooked black turtle beans, matte black ovals, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-sweet-potato',
    subject:
      'two whole sweet potatoes with reddish-brown skin, tapered shape, natural size variation, simple grouping, no packaging',
  },
  {
    id: 'ing-yeast',
    subject:
      'a small neat mound of dry instant yeast granules, pale beige, in a simple shallow ceramic bowl, soft shadow inside the bowl only, no branded packet',
  },
  {
    id: 'ing-turkey-breast',
    subject:
      'one raw boneless skinless turkey breast fillet, pale lean meat, simple three-quarter view, no packaging',
  },
  {
    id: 'ing-red-onion',
    subject:
      'one whole red onion with glossy deep purple-red papery skin and a short root end',
  },
  {
    id: 'ing-peas',
    subject:
      'a small loose pile of bright green garden peas, round and plump, natural variation, no pod clutter',
  },
  {
    id: 'ing-peppers',
    subject:
      'two whole bell peppers, one red and one yellow, smooth glossy skin, simple side-by-side, stems on, no packaging',
  },
  {
    id: 'ing-pork',
    subject:
      'one raw boneless pork loin chop with a thin fat edge, pale pink meat, simple three-quarter view, no packaging',
  },
  {
    id: 'ing-prawns',
    subject:
      'several raw whole prawns with shell on, natural grey-pink shells, curved shape, simple loose grouping, no packaging',
  },
  {
    id: 'ing-lime',
    subject:
      'one whole fresh lime with deep green slightly bumpy skin, short stem end, simple three-quarter view',
  },
  {
    id: 'ing-maple-syrup',
    subject:
      'a small plain glass jug of amber maple syrup, warm golden-brown tone, simple pourer shape, no label or branding',
  },
  {
    id: 'ing-mozzarella',
    subject:
      'one whole ball of fresh mozzarella cheese, soft matte white surface, simple sphere, no plastic wrap or packaging',
  },
  {
    id: 'ing-mixed-frozen-vegetables',
    subject:
      'a simple shallow bowl of mixed frozen vegetables, clearly showing peas, sweetcorn kernels, diced carrots, and green beans, lightly frosted, unfussy',
    dish: true,
  },
  {
    id: 'ing-lettuce',
    subject:
      'one small compact head of green lettuce, soft ruffled leaves, outer leaves slightly cupped, no dressing',
  },
  {
    id: 'ing-garlic',
    subject:
      'one whole garlic bulb with papery white-purple skin and two loose cloves beside it, simple grouping, no braid',
  },
  {
    id: 'ing-mushrooms',
    subject:
      'a small loose cluster of whole chestnut mushrooms, brown caps with short pale stems, natural size variation, no basket',
  },
  {
    id: 'ing-honey',
    subject:
      'a small plain glass jar of golden honey with a simple cork or plain lid, warm amber glow through the glass, no label or branding',
  },
  {
    id: 'ing-chickpeas',
    subject:
      'a shallow bowl of dry uncooked chickpeas, round beige legumes, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-courgette',
    subject:
      'two whole fresh courgettes zucchini, deep green smooth skin, gentle taper, simple pairing, no packaging',
  },
  {
    id: 'ing-coconut-milk',
    subject:
      'a small plain ceramic jug of creamy white coconut milk, opaque liquid, simple pourer, no tin can or carton',
    dish: true,
  },
  {
    id: 'ing-ground-beef',
    subject:
      'a neat loose mound of raw lean ground beef mince on a simple plain white shallow dish, pink-red with visible grain, no packaging',
    dish: true,
  },
  {
    id: 'ing-kale',
    subject:
      'a small loose bunch of curly kale, deep green ruffled leaves with short stems, unfussy, no dressing',
  },
  {
    id: 'ing-mustard',
    subject:
      'a small plain white ramekin of bright yellow prepared mustard, smooth glossy paste, no jar label or branding',
    dish: true,
  },
  {
    id: 'ing-tofu',
    subject:
      'one rectangular block of firm white tofu with clean cut edges, soft matte surface, simple three-quarter view, no plastic tray',
  },
  {
    id: 'ing-chorizo',
    subject:
      'one whole cured Spanish-style chorizo sausage link, deep red with visible white fat flecks, gently curved, no packaging label',
  },
  {
    id: 'ing-orange',
    subject:
      'one whole ripe orange with dimpled peel, short stem scar, warm orange color, simple three-quarter view',
  },
  {
    id: 'ing-olive-oil',
    subject:
      'a small plain unmarked glass bottle of golden-green olive oil, simple bottle silhouette, cork or plain stopper, no label or branding',
  },
  {
    id: 'ing-feta',
    subject:
      'a wedge of white feta cheese with a slightly crumbly edge, cool matte surface, simple triangular cut, no brine tub',
  },
  {
    id: 'ing-green-beans',
    subject:
      'a loose small handful of whole fresh green beans, long slender pods, natural slight curve, no packaging',
  },
  {
    id: 'ing-quinoa',
    subject:
      'a shallow bowl of dry uncooked quinoa seeds, pale beige with subtle flecks, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-celery',
    subject:
      'two whole celery stalks with a few leafy tops, pale green ribs, crisp look, simple pairing, no packaging',
  },
  {
    id: 'ing-cherry-tomatoes',
    subject:
      'a small loose cluster of ripe red cherry tomatoes, glossy round fruits, a few still on a short green vine sprig, minimal',
  },
  {
    id: 'ing-fresh-ginger',
    subject:
      'one hand of fresh ginger root, tan papery skin with knobby shape, a few small nubs, simple three-quarter view',
  },
  {
    id: 'ing-parmesan',
    subject:
      'a wedge of aged parmesan cheese, pale golden interior with small holes, hard rind edge, simple triangular cut',
  },
  {
    id: 'ing-soy-sauce',
    subject:
      'a small plain unmarked glass bottle of dark brown soy sauce, simple bottle shape, cork or plain cap, no label or Asian branding',
  },
  {
    id: 'ing-parsley',
    subject:
      'a small loose bunch of fresh flat-leaf parsley, deep green serrated leaves with short stems, no rubber band clutter',
  },
  {
    id: 'ing-peanut-butter',
    subject:
      'a small plain white ramekin of creamy peanut butter, warm tan-brown spread, smooth swirled surface, no jar label',
    dish: true,
  },
  {
    id: 'ing-almond-butter',
    subject:
      'a small plain white ramekin of creamy almond nut butter, medium brown spread with a subtle warm golden nut tone, smooth swirled surface, no jar label',
    dish: true,
  },
  {
    id: 'ing-ricotta',
    subject:
      'a small shallow bowl of fresh white ricotta cheese, soft grainy curd texture, simple ceramic bowl, no tub packaging',
    dish: true,
  },
  {
    id: 'ing-couscous',
    subject:
      'a shallow bowl of dry uncooked couscous, tiny pale golden granules, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-bratwurst',
    subject:
      'two whole uncooked bratwurst sausages, pale pink links with light speckling, simple pairing, no packaging',
  },
  {
    id: 'ing-salt',
    subject:
      'a small neat mound of coarse sea salt crystals in a simple shallow ceramic dish, translucent white flakes, soft shadow inside only',
  },
  {
    id: 'ing-black-pepper',
    subject:
      'a small neat mound of coarsely ground black pepper in a simple shallow ceramic dish, dark specks with warm brown tones, soft shadow inside only',
  },
  {
    id: 'ing-water',
    subject:
      'a simple clear glass of still water, three-quarter full, crystal-clear liquid, plain glass tumbler, no ice, no lemon',
  },
]

function getPrompt(subject, { dish = false } = {}) {
  const mid = dish
    ? 'Hand-drawn watercolor, light pencil outline with soft watercolor wash.'
    : 'Hand-drawn watercolor ingredient study, light pencil outline with soft watercolor wash.'
  const layout = dish
    ? 'Minimal cookbook-style food painting of one dish, delicate and clean, lots of negative space around the bowl.'
    : 'Minimal cookbook-style spot art, delicate and clean, lots of negative space.'
  const neg = dish
    ? 'Negative: no photorealism, no vector icon style, no heavy outlines, no cluttered background, no text, no packaging, no scattered cutlery or extra props.'
    : 'Negative: no photorealism, no vector icon style, no heavy outlines, no cluttered background, no text, no extra props.'
  return [
    `A simple watercolor food illustration of ${subject}.`,
    mid,
    'Isolated on a pure white background.',
    layout,
    neg,
  ].join(' ')
}

const key = process.env.OPENAI_API_KEY
if (!key?.trim()) {
  console.error('Missing OPENAI_API_KEY. Run: node --env-file=.env scripts/generate-seed-image.mjs')
  process.exit(1)
}

const dir = join(root, 'public/images/seed')
mkdirSync(dir, { recursive: true })

const onlyIds = process.argv.slice(2).map((s) => s.trim()).filter(Boolean)
const toGenerate = onlyIds.length ? ITEMS.filter((i) => onlyIds.includes(i.id)) : ITEMS
if (onlyIds.length) {
  const missing = onlyIds.filter((id) => !ITEMS.some((i) => i.id === id))
  if (missing.length) {
    console.error(`Unknown seed image id(s): ${missing.join(', ')}`)
    console.error(`Known: ${ITEMS.map((i) => i.id).join(', ')}`)
    process.exit(1)
  }
}

for (const item of toGenerate) {
  console.log(`Generating ${item.id}...`)
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: getPrompt(item.subject, { dish: item.dish === true }),
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
