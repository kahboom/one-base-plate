import { readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SEED_DIR = 'public/images/seed';
const THUMB_DIR = join(SEED_DIR, 'thumbs');

const WIDTHS = {
  sm: 64,
  md: 256,
  lg: 512,
};

if (!existsSync(THUMB_DIR)) {
  mkdirSync(THUMB_DIR, { recursive: true });
}

const files = readdirSync(SEED_DIR).filter(
  (f) => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
);

let processedCount = 0;
let skippedCount = 0;
let errorCount = 0;

async function processFile(file) {
  const sourcePath = join(SEED_DIR, file);
  const basename = file.replace(/\.[^.]+$/, '');
  const sourceStats = statSync(sourcePath);

  const tasks = Object.entries(WIDTHS).map(async ([size, width]) => {
    const outPath = join(THUMB_DIR, `${basename}-${width}w.webp`);
    
    // Skip if thumb exists and is newer than source
    if (existsSync(outPath)) {
      const outStats = statSync(outPath);
      if (outStats.mtimeMs > sourceStats.mtimeMs) {
        return { skipped: true };
      }
    }

    await sharp(sourcePath)
      .resize(width, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(outPath);

    return { skipped: false };
  });

  const results = await Promise.all(tasks);
  const allSkipped = results.every(r => r.skipped);

  if (allSkipped) {
    skippedCount++;
  } else {
    processedCount++;
    console.log(`Generated thumbnails for ${file}`);
  }
}

async function main() {
  console.log(`Found ${files.length} seed images. Generating WebP thumbnails...`);
  
  // Process in batches of 10 to avoid too many open files or high memory usage
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map(file => 
      processFile(file).catch(err => {
        console.error(`Error processing ${file}:`, err);
        errorCount++;
      })
    ));
  }

  console.log('Done!');
  console.log(`Processed: ${processedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
