export type ThumbSize = 'sm' | 'md' | 'lg';

const SEED_PREFIX = '/images/seed/';

export function resolveThumbUrl(imageUrl: string | undefined, size: ThumbSize): string | undefined {
  if (!imageUrl) return undefined;
  // Only transform local seed image paths
  if (!imageUrl.startsWith(SEED_PREFIX)) return imageUrl;
  // data: URLs pass through
  if (imageUrl.startsWith('data:')) return imageUrl;

  const widths = { sm: 64, md: 256, lg: 512 } as const;
  const basename = imageUrl.slice(SEED_PREFIX.length).replace(/\.[^.]+$/, '');
  return `${SEED_PREFIX}thumbs/${basename}-${widths[size]}w.webp`;
}
