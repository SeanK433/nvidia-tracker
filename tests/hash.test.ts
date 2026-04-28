import { describe, it, expect } from 'vitest';
import { hashUrl } from '../scripts/lib/hash';

describe('hashUrl', () => {
  it('returns a 64-char hex string', () => {
    const hash = hashUrl('https://example.com/article');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is stable for the same input', () => {
    const a = hashUrl('https://example.com/article');
    const b = hashUrl('https://example.com/article');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', () => {
    const a = hashUrl('https://example.com/article');
    const b = hashUrl('https://example.com/different');
    expect(a).not.toBe(b);
  });

  it('normalizes URL by lowercasing and stripping trailing slash', () => {
    const a = hashUrl('https://Example.com/Article');
    const b = hashUrl('https://example.com/article/');
    const c = hashUrl('https://example.com/article');
    expect(a).toBe(c);
    expect(b).toBe(c);
  });
});
