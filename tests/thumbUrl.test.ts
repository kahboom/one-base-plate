import { describe, it, expect } from 'vitest';
import { resolveThumbUrl } from '../src/lib/thumbUrl';

describe('resolveThumbUrl', () => {
  it('returns undefined for undefined/empty input', () => {
    expect(resolveThumbUrl(undefined, 'sm')).toBeUndefined();
    expect(resolveThumbUrl('', 'md')).toBeUndefined();
  });

  it('passes through external URLs', () => {
    const url = 'https://images.unsplash.com/photo-123';
    expect(resolveThumbUrl(url, 'sm')).toBe(url);
  });

  it('passes through data URLs', () => {
    const url = 'data:image/png;base64,iVBORw0KGgo';
    expect(resolveThumbUrl(url, 'lg')).toBe(url);
  });

  it('transforms seed image paths to appropriate WebP thumbnail paths', () => {
    const url = '/images/seed/bm-pasta-chicken.png';
    expect(resolveThumbUrl(url, 'sm')).toBe('/images/seed/thumbs/bm-pasta-chicken-64w.webp');
    expect(resolveThumbUrl(url, 'md')).toBe('/images/seed/thumbs/bm-pasta-chicken-256w.webp');
    expect(resolveThumbUrl(url, 'lg')).toBe('/images/seed/thumbs/bm-pasta-chicken-512w.webp');
  });

  it('handles jpg/jpeg seed images', () => {
    const url = '/images/seed/test.jpg';
    expect(resolveThumbUrl(url, 'md')).toBe('/images/seed/thumbs/test-256w.webp');
  });
});
