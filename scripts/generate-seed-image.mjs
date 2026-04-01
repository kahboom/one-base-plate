/**
 * Batch seed image generation via OpenAI Images API.
 * Usage from repo root: node --env-file=.env scripts/generate-seed-image.mjs
 * Optional: pass one or more seed ids to generate only those images, e.g. .../generate-seed-image.mjs ing-bacon ing-banana
 *
 * Requires OPENAI_API_KEY in .env (see .env.example).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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
  {
    id: 'ing-carrots',
    subject:
      'exactly three whole carrots with very short trimmed stems, no leafy tops at all, laid side by side at a gentle diagonal, smooth orange skin, nothing else in the image',
  },
  {
    id: 'rec-spaghetti-bolognese',
    subject: 'a simple bowl of spaghetti with meat bolognese sauce, readable and unfussy',
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
  {
    id: 'ing-avocado',
    subject:
      'one single halved avocado showing the smooth large pit, bright green flesh graduating to pale yellow near the pit, dark green skin, three-quarter angle, nothing else in the image, no knife, no lime',
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
    subject:
      'a small neat cluster of plump fresh blueberries, dusty blue-purple with a natural bloom, natural size variation, no stems, no leaves, no bowl, nothing else',
  },
  {
    id: 'ing-banana',
    subject: 'one whole ripe yellow banana with a hint of green at the stem, gentle curve',
  },
  {
    id: 'ing-bacon',
    subject: 'several raw streaky bacon rashers, pink meat and creamy white fat marbling, uncooked',
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
      'one single classic French baguette with a golden scored crust, placed horizontally and centered in the frame so both ends are fully visible, the full length fits within the image, pure white background, nothing else in the image, no crumbs, no basket, no cloth, no board',
  },
  {
    id: 'ing-apple',
    subject:
      'one single whole red apple with a short stem, natural red skin with subtle variation, simple three-quarter view, nothing else in the image',
  },
  {
    id: 'ing-arepa',
    subject:
      'two thick round white-corn arepas, lightly griddled with subtle golden-brown marks, one showing a soft pale interior at the edge, stacked slightly offset, no fillings, no plate, nothing else in the image',
  },
  {
    id: 'ing-eggs',
    subject:
      'three whole brown chicken eggs arranged in a simple loose cluster, smooth natural shells, no carton, no bowl, nothing else in the image',
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
    subject: 'one raw sirloin steak with light marbling, simple three-quarter view, no grill marks',
  },
  {
    id: 'ing-pita-bread',
    subject: 'two round soft pita breads, slightly puffed, pale golden, stacked loosely',
  },
  {
    id: 'ing-spinach',
    subject:
      'a single compact bunch of fresh spinach with stems gathered together, deep green, viewed from a slight angle, no scattered or loose leaves around it, nothing else in the image',
  },
  {
    id: 'ing-broccoli',
    subject:
      'a single whole fresh broccoli head with a short thick stalk, vivid deep green, centered in the frame, three-quarter view, only one broccoli, no second head, no loose florets, nothing else in the image',
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
    subject:
      'one single whole brown cooking onion with dry papery skin and a short root end, three-quarter view, nothing else in the image',
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
    subject: 'one whole red onion with glossy deep purple-red papery skin and a short root end',
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
    id: 'ing-prawn',
    subject:
      'one single large raw whole prawn with shell on, natural grey-translucent shell, gently curved shape, simple side view, nothing else in the image, no packaging, no bowl',
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
      'one single rectangular block of white feta cheese with a slightly crumbly surface, cool matte texture, clean cut edges, nothing else in the image, no brine tub, no bowl',
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
      'one single small bunch of fresh flat-leaf parsley, bright deep green serrated leaves with short stems, simple upright view, nothing else in the image, no rubber band, no board',
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
  {
    id: 'ing-almond-flour',
    subject:
      'a neat mound of fine pale cream almond flour in a simple shallow ceramic bowl, finely ground meal with a slightly golden tint, soft shadow inside only',
  },
  {
    id: 'ing-balsamic-vinegar',
    subject:
      'a small plain unmarked glass bottle of dark rich balsamic vinegar, deep brown-black liquid with a slight gloss, cork stopper, no label or branding',
  },
  {
    id: 'ing-basil',
    subject:
      'a small loose bunch of fresh sweet basil with vivid bright green rounded leaves on short stems, gentle three-quarter view, nothing else in the image, no other herbs',
  },
  {
    id: 'ing-bay-leaves',
    subject:
      'one single whole dried bay leaf, pale sage-green with clear natural vein detail, slightly curled edges, centered top-down view, nothing else in the image, only one leaf',
  },
  {
    id: 'ing-brown-lentils',
    subject:
      'a shallow bowl of dry uncooked brown lentils, small flat discs in warm earthy brown tones, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-butter-beans',
    subject:
      'a shallow bowl of large plump pale cream butter beans, smooth round-edged ovals, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-cannellini-beans',
    subject:
      'a shallow bowl of dry uncooked cannellini beans, large smooth white kidney-shaped ovals, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-chicken-stock',
    subject:
      'a small plain ceramic jug of golden amber chicken stock, warm clear liquid with a light sheen, simple jug shape, no label, gentle steam implied',
    dish: true,
  },
  {
    id: 'ing-beef-stock',
    subject:
      'a small plain ceramic jug of rich dark brown beef stock, deep glossy liquid, simple jug shape, no label, gentle steam implied',
    dish: true,
  },
  {
    id: 'ing-beef-stock-cube',
    subject:
      'a single small beef stock bouillon cube with soft brown and reddish-brown tones, plain foil-wrapped rectangular block with absolutely no text or logos, isolated on white',
  },
  {
    id: 'ing-chicken-stock-cube',
    subject:
      'a single small chicken bouillon stock cube with gentle golden-yellow and pale amber tones, plain wrapped block with no labels, isolated on white',
  },
  {
    id: 'ing-vegetable-stock-cube',
    subject:
      'a single small vegetable stock bouillon cube with soft muted green and herb-toned color, plain wrapped block with no text, isolated on white',
  },
  {
    id: 'ing-chili-powder',
    subject:
      'a small neat mound of vibrant red-orange chili powder in a simple shallow ceramic dish, bold warm dried spice color, soft shadow inside only',
  },
  {
    id: 'ing-coconut-oil',
    subject:
      'a small plain glass jar of solid white coconut oil, smooth opaque surface, simple jar shape with a plain lid, no label or branding',
  },
  {
    id: 'ing-cornmeal',
    subject:
      'a neat mound of golden-yellow cornmeal in a simple shallow ceramic bowl, coarse granular texture with a warm maize color, soft shadow inside only',
  },
  {
    id: 'ing-cream-cheese',
    subject:
      'a small plain white ramekin of thick smooth cream cheese, soft scooped surface with gentle indent, cool matte white texture, no packaging',
    dish: true,
  },
  {
    id: 'ing-creme-fraiche',
    subject:
      'a small plain white ramekin of thick white creme fraiche, smooth cool surface, simple ceramic dish, no packaging or branding',
    dish: true,
  },
  {
    id: 'ing-cumin',
    subject:
      'a small neat mound of warm earthy brown ground cumin in a simple shallow ceramic dish, rich ochre-brown tone, soft shadow inside only',
  },
  {
    id: 'ing-double-cream',
    subject:
      'a small plain ceramic jug of thick double cream being poured, opaque white liquid with visible viscosity, simple pourer shape, no label or branding',
    dish: true,
  },
  {
    id: 'ing-duck-breast',
    subject:
      'one raw boneless duck breast with a thick layer of pale cream fat scored in a crosshatch pattern on top, deep pink-red meat beneath, simple three-quarter view, no packaging',
  },
  {
    id: 'ing-edamame',
    subject:
      'a small loose pile of bright vivid green edamame soybeans in their pods, plump and smooth, natural size variation, no packaging, no bowl',
  },
  {
    id: 'ing-cheese',
    subject:
      'a small neat wedge of pale yellow hard cheese with a natural rind edge and two thin slices laid beside it, simple arrangement, no packaging or labels',
  },
  {
    id: 'ing-lasagne-sheets',
    subject:
      'a small neat stack of dry flat lasagne pasta sheets, pale golden, slightly wavy edges, simple top-down angle, no packaging',
  },
  {
    id: 'ing-kidney-beans',
    subject:
      'a shallow bowl of dry uncooked kidney beans, deep glossy red-brown kidney shapes, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-italian-seasoning',
    subject:
      'a small neat mound of dried Italian herb seasoning blend in a simple shallow ceramic dish, mixed green-brown flecks, soft shadow inside only',
  },
  {
    id: 'ing-passata',
    subject:
      'a plain unmarked glass bottle of smooth bright red passata tomato sauce, simple bottle shape, no label or branding, simple side view',
  },
  {
    id: 'ing-oregano',
    subject:
      'a small neat mound of dried oregano in a simple shallow ceramic dish, dusty olive-green dried herb flecks, soft shadow inside only',
  },
  {
    id: 'ing-pecorino',
    subject:
      'a small wedge of aged pecorino cheese with a hard pale rind edge and dense granular white interior, simple triangular cut, nothing else in the image',
  },
  {
    id: 'ing-pinto-beans',
    subject:
      'a shallow bowl of dry uncooked pinto beans, speckled beige and rust-brown mottled pattern, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-thyme',
    subject:
      'a small green cooking herb sprig with tiny rounded leaves along a thin stem, kitchen herb, gentle three-quarter view on white background',
  },
  {
    id: 'ing-sun-dried-tomatoes',
    subject:
      'a small loose pile of sun-dried tomato halves, deep ruby-red and slightly wrinkled, glistening with oil, no jar packaging',
  },
  {
    id: 'ing-bread-flour',
    subject:
      'a neat mound of white bread flour in a simple shallow ceramic bowl, fine smooth powder with a bright white tone, soft shadow inside only',
  },
  {
    id: 'ing-tahini',
    subject:
      'a small plain white ramekin of thick pale golden tahini sesame paste, smooth swirled surface with a warm ivory tone, no jar label',
    dish: true,
  },
  {
    id: 'ing-spring-onions',
    subject:
      'a small loose bundle of fresh spring onions scallions, bright green tops and white bulb ends, trimmed, simple three-quarter view, nothing else in the image',
  },
  {
    id: 'ing-rosemary',
    subject:
      'one fresh green cooking herb sprig with long narrow needle-like leaves along a thin stem, kitchen herb, simple side view on white background',
  },
  {
    id: 'ing-romaine-lettuce',
    subject:
      'one whole romaine lettuce heart with crisp elongated pale-green leaves, slightly cupped, upright three-quarter view, no dressing',
  },
  {
    id: 'ing-rice-flour',
    subject:
      'a neat mound of fine white rice flour in a simple shallow ceramic bowl, very smooth bright white powder, soft shadow inside only',
  },
  {
    id: 'ing-worcestershire-sauce',
    subject:
      'a small plain unmarked glass bottle of dark rich Worcestershire sauce, deep brown-black liquid, simple bottle shape, cork or plain cap, no label or branding',
  },
  {
    id: 'ing-wholemeal-bread',
    subject:
      'one whole UK-style wholemeal tin loaf with a split top, dark brown seeded crust, uncut, simple three-quarter view, no basket',
  },
  {
    id: 'ing-white-wine-vinegar',
    subject:
      'a small plain unmarked glass bottle of clear pale white wine vinegar, simple bottle silhouette, cork stopper, no label or branding',
  },
  {
    id: 'ing-vanilla-extract',
    subject:
      'a small plain dark glass bottle of vanilla extract with deep amber-brown liquid, plain cap, no label, beside one split vanilla bean pod showing tiny black seeds, gentle grouping',
  },
  {
    id: 'ing-vegetable-stock',
    subject:
      'a small plain ceramic jug of clear golden-amber vegetable stock, warm liquid with light sheen, simple jug shape, no label, gentle steam implied',
    dish: true,
  },
  {
    id: 'ing-wholemeal-flour',
    subject:
      'a neat mound of coarse wholemeal flour in a simple shallow ceramic bowl, warm brown-beige granular texture, soft shadow inside only',
  },
  {
    id: 'ing-sour-cream',
    subject:
      'a small plain white ramekin of thick white sour cream, smooth cool surface with slight sheen, simple ceramic dish, no packaging',
    dish: true,
  },
  {
    id: 'ing-smoked-paprika',
    subject:
      'a small neat mound of deep brick-red smoked paprika in a simple shallow ceramic dish, rich smoky red tone, soft shadow inside only',
  },
  {
    id: 'ing-sesame-oil',
    subject:
      'a small plain unmarked glass bottle of golden-amber sesame oil, warm toasted color, simple bottle silhouette, cork or plain cap, no label or branding',
  },
  {
    id: 'ing-cilantro',
    subject:
      'a small loose bunch of fresh cilantro coriander with bright vivid green delicate leaves on thin stems, gentle three-quarter view, nothing else in the image',
  },
  {
    id: 'ing-lamb-mince',
    subject:
      'a neat loose mound of raw ground lamb mince on a simple plain white shallow dish, pale pink with visible fat marbling, no packaging',
    dish: true,
  },
  {
    id: 'ing-turkey-mince',
    subject:
      'a neat loose mound of raw ground turkey mince on a simple plain white shallow dish, very pale pink-beige lean meat, no packaging',
    dish: true,
  },
  {
    id: 'ing-queso-fresco',
    subject:
      'a small rectangular block of crumbly white queso fresco cheese, soft matte surface with visible curd texture, simple three-quarter view, no packaging',
  },
  {
    id: 'ing-miso-paste',
    subject:
      'a small plain white ramekin of smooth golden-brown miso paste, earthy warm tone, thick dense surface with a slight sheen, no packaging',
    dish: true,
  },
  {
    id: 'ing-ramen-noodles',
    subject:
      'a loose nest of dry uncooked ramen noodles, pale golden thin curly strands in a loose coiled bundle, no packaging or broth',
  },
  {
    id: 'ing-goat-cheese',
    subject:
      'one small soft log of fresh white goat cheese with a chalky matte rind, simple three-quarter view, no packaging or label',
  },
  {
    id: 'ing-garlic-powder',
    subject:
      'a small neat mound of fine pale beige garlic powder in a simple shallow ceramic dish, soft shadow inside only',
  },
  {
    id: 'ing-gnocchi',
    subject:
      'a loose small pile of dry uncooked potato gnocchi, ridged oval dumplings in warm off-white tones, no sauce, no packaging',
  },
  {
    id: 'ing-green-cabbage',
    subject:
      'one compact half head of green cabbage showing pale inner leaves and waxy outer green layers, cut face visible, simple three-quarter view',
  },
  {
    id: 'ing-tomato-ketchup',
    subject:
      'a small plain white ramekin of glossy bright red tomato ketchup, smooth surface, no bottle label or branding',
    dish: true,
  },
  {
    id: 'ing-tomato-paste',
    subject:
      'one soft foil or metal tube of tomato paste lying at a gentle angle, twist cap, nostalgic plain packaging with a simple illustrated whole tomato on the tube front, no readable brand name or lettering',
  },
  {
    id: 'ing-tomato-sauce',
    subject:
      'a small shallow bowl of smooth red tomato pasta sauce, simple and readable, no jar branding',
    dish: true,
  },
  {
    id: 'ing-tinned-tuna',
    subject:
      'one plain unlabeled metal tin of tuna in oil, simple side view, pull-tab top, no readable text or branding',
  },
  {
    id: 'ing-red-cabbage',
    subject:
      'one wedge slice of red cabbage showing vivid purple layers and white core, crisp texture, simple three-quarter view',
  },
  {
    id: 'ing-dijon-mustard',
    subject:
      'a small plain white ramekin of smooth pale brown dijon mustard, subtle grain, distinctly not bright yellow, no jar label',
    dish: true,
  },
  {
    id: 'ing-cod',
    subject:
      'one raw boneless cod fillet, bright white flaky fish with a slight translucency, simple three-quarter view, no packaging',
  },
  {
    id: 'ing-tilapia',
    subject:
      'one raw tilapia fillet, pale pink-white mild fish, simple three-quarter view, no packaging',
  },
  {
    id: 'ing-butternut-squash',
    subject:
      'one whole small butternut squash, beige neck and deep orange bulb, smooth skin, simple three-quarter view, uncut',
  },
  {
    id: 'ing-breadcrumbs',
    subject:
      'a shallow bowl of dry fine golden breadcrumbs, even crumb texture, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-sage',
    subject:
      'one small sprig of fresh culinary sage, soft silvery-green oval leaves on a thin stem, gentle three-quarter view, nothing else in the image',
  },
  {
    id: 'ing-water-crackers',
    subject:
      'a short neat stack of square thin water crackers, pale golden with subtle baked flecks, crisp edges, no packaging',
  },
  {
    id: 'ing-onion-powder',
    subject:
      'a small neat mound of fine pale tan onion powder in a simple shallow ceramic dish, soft shadow inside only',
  },
  {
    id: 'ing-curry-paste',
    subject:
      'a small plain white ramekin of thick red-brown curry paste, rich spice paste texture, no jar label',
    dish: true,
  },
  {
    id: 'ing-digestive-biscuit',
    subject:
      'a small loose stack of round golden digestive biscuits, even baked color, simple wheat biscuit look, no packaging sleeve',
  },
  {
    id: 'ing-watermelon',
    subject:
      'one generous wedge slice of watermelon with deep pink-red flesh, black seeds, and a band of pale rind, simple side view',
  },
  {
    id: 'ing-wheat-germ',
    subject:
      'a small neat mound of toasted wheat germ in a simple shallow ceramic bowl, golden flaky meal texture, soft shadow inside only',
  },
  {
    id: 'ing-chocolate-chips',
    subject:
      'a small loose pile of dark brown chocolate chips, teardrop morsel shape, matte chocolate, natural size variation, no packaging',
  },
  {
    id: 'ing-rye-flour',
    subject:
      'a neat mound of fine grey-brown rye flour in a simple shallow ceramic bowl, slightly coarse wholegrain tone, soft shadow inside only',
  },
  {
    id: 'ing-flour-tortillas',
    subject:
      'a short stack of four soft flour tortillas, pale off-white with light golden flecks, soft pliable rounds, slightly uneven handmade edges, no packaging',
  },
  {
    id: 'ing-risotto-rice',
    subject:
      'a shallow bowl of dry uncooked arborio risotto rice, short plump pearly white grains with a subtle chalky sheen, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-garlic-granules',
    subject:
      'a small neat pile of coarse garlic granules in a simple shallow ceramic dish, pale beige with visible grainy texture unlike fine powder, soft shadow inside only',
  },
  {
    id: 'ing-onion-granules',
    subject:
      'a small neat pile of coarse onion granules in a simple shallow ceramic dish, warm tan with visible grainy texture, soft shadow inside only',
  },
  {
    id: 'ing-spaghetti',
    subject:
      'a neat loose bundle of dry uncooked spaghetti, long thin golden strands, naturally grouped, no packaging',
  },
  {
    id: 'ing-breadsticks',
    subject:
      'a loose bundle of several long thin grissini-style breadsticks, crisp golden-brown baked dough with a light salt fleck, simple diagonal grouping, no dip, no bowl, no packaging',
  },
  {
    id: 'ing-burger-buns',
    subject:
      'one matched pair of burger buns only, top and bottom halves slightly separated to show completely empty insides, no patty, no cheese, no lettuce, no fillings, soft sesame-topped golden crust, no packaging or tray, nothing else in the image',
  },
  {
    id: 'ing-hot-dog-bun',
    subject:
      'one empty split-top hot dog bun only, elongated pale golden roll with a clear open slit showing hollow empty interior, no sausage, no fillings, no condiments, no packaging, nothing else in the image',
  },
  {
    id: 'ing-hot-dog',
    subject:
      'exactly one single uncooked frankfurter-style hot dog sausage, smooth pink casing, evenly cylindrical, gentle curve, no second sausage, no bun, no packaging, no grill marks, nothing else in the image',
  },
  {
    id: 'ing-sauerkraut',
    subject:
      'a small shallow bowl of sauerkraut, shredded pale cabbage with a tangy fermented look, simple ceramic bowl, soft shadow inside only',
    dish: true,
  },
  {
    id: 'ing-pickles',
    subject:
      'a small loose pile of whole dill pickles, knobbly green cucumbers in brine sheen, no jar, no label',
  },
  {
    id: 'ing-dill',
    subject:
      'one delicate sprig of fresh dill weed, feathery bright green fronds on thin stems, gentle three-quarter view, nothing else in the image',
  },
  {
    id: 'ing-cucumber',
    subject:
      'one whole fresh cucumber with deep green waxy skin, gentle bumps, simple three-quarter view, uncut, no slices',
  },
  {
    id: 'ing-orecchiette',
    subject:
      'a loose small pile of dry uncooked orecchiette pasta, small ear-shaped discs in warm pale golden tones, lightly ridged, no sauce, no packaging',
  },
  {
    id: 'ing-ancho-chile',
    subject:
      'two whole dried ancho chiles, wide deep red-brown wrinkled poblano pods, matte dried skin, simple pairing, no stem clutter',
  },
  {
    id: 'ing-corn-on-the-cob',
    subject:
      'two whole ears of corn on the cob with fresh green husks peeled back to show plump yellow kernels in neat rows, simple three-quarter view, no butter, no grill marks',
  },
  {
    id: 'ing-corn-kernels',
    subject:
      'a shallow bowl of loose bright yellow sweetcorn kernels, plump individual kernels, simple ceramic bowl, soft shadow inside only, no cob, no husk',
    dish: true,
  },
  {
    id: 'ing-beetroot',
    subject:
      'two whole raw beetroots with deep magenta-purple skin, leafy tops trimmed to very short stubs, earthy root tails, simple three-quarter grouping, no knife',
  },
  {
    id: 'ing-whiskey',
    subject:
      'a short plain glass tumbler with a modest pour of amber whiskey, no ice, no label, no bottle, no branding',
  },
  {
    id: 'ing-bourbon',
    subject:
      'a short plain glass tumbler with a modest pour of deep golden American bourbon whiskey, warm copper-amber tone, no ice, no label, no bottle, no branding',
  },
  {
    id: 'ing-lager',
    subject:
      'a simple tall beer glass with pale golden lager and a small neat white foam head, bright and clear, no bottle, no label, no branding, no logo',
    dish: true,
  },
  {
    id: 'ing-dark-beer',
    subject:
      'a simple beer glass with dark brown almost black beer and a thin tan foam head, rich stout-like color, no bottle, no label, no branding, no logo',
    dish: true,
  },
  {
    id: 'ing-molasses',
    subject:
      'a small clear glass jar of thick dark brown molasses with the wide mouth visible, rich glossy syrup, plain unlabeled jar',
  },
  {
    id: 'ing-icing-sugar',
    subject:
      'a shallow ceramic bowl of fine snowy white powdered icing sugar as a soft sifted mound, delicate texture, no spoon',
  },
  {
    id: 'ing-jacket-potato',
    subject:
      'one baked jacket potato with skin split open showing fluffy pale steamy interior, a small pat of melting butter, simple white plate',
    dish: true,
  },
  {
    id: 'ing-swede',
    subject:
      'one whole swede rutabaga with purple crown fading to creamy yellow body, waxy root skin, short trimmed root tail, three-quarter view',
  },
  {
    id: 'ing-parsnip',
    subject:
      'three whole parsnips with creamy ivory tapered roots and short trimmed tops, gentle natural curves, grouped simply, no peelings',
  },
  {
    id: 'ing-caster-sugar',
    subject:
      'a shallow bowl of fine white caster sugar crystals, slightly finer than granulated, soft sparkle, simple ceramic bowl, soft shadow inside only',
  },
  {
    id: 'ing-coriander-seed',
    subject:
      'a small loose pile of whole dried coriander seeds, round tan ribbed seeds, natural variation, no powder, no mortar, nothing else',
  },
  {
    id: 'ing-fenugreek-seed',
    subject:
      'a small loose cluster of whole fenugreek seeds, small amber-ochre angular seeds, readable texture, no powder, nothing else',
  },
  {
    id: 'ing-bok-choy',
    subject:
      'one fresh baby bok choy with crisp white stalks and deep green spoon-shaped leaves, upright three-quarter view, no wok, no sauce',
  },
  {
    id: 'ing-radish',
    subject:
      'a loose small bunch of round red radishes with short white roots and a little fresh green stem, no leaves spread everywhere, nothing else',
  },
  {
    id: 'ing-fennel',
    subject:
      'one fresh fennel bulb with pale green-white layered base and delicate feathery green fronds on top, three-quarter view, no slicing board',
  },
  {
    id: 'ing-turnip',
    subject:
      'two whole purple-top turnips with creamy white lower bodies, thin tap roots trimmed short, simple grouping, no soil clumps',
  },
  {
    id: 'ing-sugar-snap-peas',
    subject:
      'a small loose pile of plump bright green sugar snap pea pods, crisp and slightly curved, visible peas inside, no snow peas, nothing else',
  },
  {
    id: 'ing-mango',
    subject:
      'one whole ripe mango with smooth skin in warm yellow-orange-red blush, gentle oval shape, short stem stub, uncut, no leaves',
  },
  {
    id: 'ing-pear',
    subject:
      'two whole fresh pears with natural green-gold skin and subtle russet speckles, classic teardrop silhouettes, short stems',
  },
  {
    id: 'ing-peach',
    subject:
      'two whole fuzzy ripe peaches with soft pink-orange blush over warm yellow, natural dimple at stem end, no slices',
  },
  {
    id: 'ing-plum',
    subject:
      'three small whole plums in deep purple-red skin with soft bloom, natural size variation, no leaves, no pit exposed',
  },
  {
    id: 'ing-grapefruit',
    subject:
      'one whole pink grapefruit with slightly pebbled yellow-pink peel, round shape, short stem, uncut, no second fruit',
  },
  {
    id: 'ing-semi-skimmed-milk',
    subject:
      'a simple clear drinking glass about three-quarters full of pale white milk, light and unfussy, no carton, no label, no branding',
    dish: true,
  },
  {
    id: 'ing-brown-rice',
    subject:
      'a shallow bowl of uncooked brown rice grains, long-grain style with natural tan-brown bran flecks, dry loose pile, soft shadow inside the bowl only',
    dish: true,
  },
  {
    id: 'ing-cornflakes',
    subject:
      'a small loose pile of golden toasted cornflakes cereal flakes, thin crisp texture, no milk, no bowl with branding, no box, no readable text',
  },
  {
    id: 'ing-aptamil',
    subject:
      'a plain unlabeled round metal tin of white infant formula milk powder beside a small plastic scoop with a little powder on it, simple and clean, absolutely no brand name, no logo, no readable text on the tin',
    dish: true,
  },
  {
    id: 'ing-almonds',
    subject:
      'a small loose pile of whole natural almonds with brown skins, a few split to show pale interior, no shell, no packaging',
  },
  {
    id: 'ing-peanuts',
    subject:
      'a small loose pile of shelled roasted peanuts, pinkish-tan skins, no shells, no red skins only, no packaging',
  },
  {
    id: 'ing-cashews',
    subject:
      'a small loose pile of whole curved cashew nuts, creamy ivory color, no salt visible, no packaging',
  },
  {
    id: 'ing-sesame-seeds',
    subject:
      'a small loose pile of mixed white and pale tan sesame seeds, tiny flat oval seeds, dry, no oil, no packaging',
  },
  {
    id: 'ing-olives',
    subject:
      'a small shallow bowl of mixed black and deep purple kalamata-style olives with pits, light brine sheen, no jar label, no readable text',
    dish: true,
  },
  {
    id: 'ing-capers',
    subject:
      'a small shallow dish of tiny green capers in clear brine, simple ceramic dish, no jar, no label, no readable text',
    dish: true,
  },
  {
    id: 'ing-fish-sauce',
    subject:
      'a small plain glass bottle of dark amber fish sauce with a simple cork or plain stopper, side view, absolutely no label, no brand text, no logo',
  },
  {
    id: 'ing-poppy-seeds',
    subject: 'a small loose pile of tiny blue-black poppy seeds, dry, matte, no packaging',
  },
  {
    id: 'ing-pickled-onions',
    subject:
      'a small shallow bowl of whole small pearl pickled onions in pale vinegar brine, silverskin style, light pinkish skins, no jar label, no readable text',
    dish: true,
  },
];

function getPrompt(subject, { dish = false } = {}) {
  const mid = dish
    ? 'Hand-drawn watercolor, light pencil outline with soft watercolor wash.'
    : 'Hand-drawn watercolor ingredient study, light pencil outline with soft watercolor wash.';
  const layout = dish
    ? 'Minimal cookbook-style food painting of one dish, delicate and clean, lots of negative space around the bowl.'
    : 'Minimal cookbook-style spot art, delicate and clean, lots of negative space.';
  const neg = dish
    ? 'Negative: no photorealism, no vector icon style, no heavy outlines, no cluttered background, no text, no packaging, no scattered cutlery or extra props.'
    : 'Negative: no photorealism, no vector icon style, no heavy outlines, no cluttered background, no text, no extra props.';
  return [
    `A simple watercolor food illustration of ${subject}.`,
    mid,
    'Isolated on a pure white background.',
    layout,
    neg,
  ].join(' ');
}

const key = process.env.OPENAI_API_KEY;
if (!key?.trim()) {
  console.error(
    'Missing OPENAI_API_KEY. Run: node --env-file=.env scripts/generate-seed-image.mjs',
  );
  process.exit(1);
}

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 3000;

const dir = join(root, 'public/images/seed');
mkdirSync(dir, { recursive: true });

const skipExisting = process.argv.includes('--skip-existing');
const onlyIds = process.argv
  .slice(2)
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => s !== '--skip-existing');
let toGenerate = onlyIds.length ? ITEMS.filter((i) => onlyIds.includes(i.id)) : ITEMS;
if (onlyIds.length) {
  const missing = onlyIds.filter((id) => !ITEMS.some((i) => i.id === id));
  if (missing.length) {
    console.error(`Unknown seed image id(s): ${missing.join(', ')}`);
    console.error(`Known: ${ITEMS.map((i) => i.id).join(', ')}`);
    process.exit(1);
  }
}

if (skipExisting) {
  const before = toGenerate.length;
  toGenerate = toGenerate.filter((i) => !existsSync(join(dir, `${i.id}.png`)));
  const skipped = before - toGenerate.length;
  if (skipped) console.log(`--skip-existing: skipping ${skipped} image(s) that already exist`);
}

if (toGenerate.length === 0) {
  console.log('Nothing to generate.');
  process.exit(0);
}

async function generateOne(item) {
  console.log(`Generating ${item.id}...`);
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
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`OpenAI API error for ${item.id}:`, JSON.stringify(data, null, 2));
    return false;
  }

  const url = data.data?.[0]?.url;
  if (!url) {
    console.error(`Unexpected response for ${item.id}:`, data);
    return false;
  }

  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    console.error(`Failed to download image for ${item.id}:`, imgRes.status);
    return false;
  }

  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = join(dir, `${item.id}.png`);
  writeFileSync(outPath, buf);
  console.log(`Wrote ${outPath}`);
  return true;
}

console.log(`Generating ${toGenerate.length} image(s) in batches of ${BATCH_SIZE}...`);

let ok = 0;
let fail = 0;
for (let i = 0; i < toGenerate.length; i += BATCH_SIZE) {
  const batch = toGenerate.slice(i, i + BATCH_SIZE);
  const batchNum = Math.floor(i / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(toGenerate.length / BATCH_SIZE);
  console.log(`\n--- Batch ${batchNum}/${totalBatches} (${batch.map((b) => b.id).join(', ')}) ---`);

  const results = await Promise.allSettled(batch.map((item) => generateOne(item)));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) ok++;
    else fail++;
  }

  if (i + BATCH_SIZE < toGenerate.length) {
    console.log(`Waiting ${BATCH_DELAY_MS / 1000}s before next batch...`);
    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }
}

console.log(`\nDone: ${ok} generated, ${fail} failed, ${toGenerate.length} total.`);
