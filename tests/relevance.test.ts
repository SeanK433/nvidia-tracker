import { describe, it, expect } from 'vitest';
import { isRelevant } from '../scripts/lib/relevance';

describe('isRelevant', () => {
  it('keeps articles that mention Nvidia', () => {
    expect(isRelevant({ title: 'Nvidia announces new chip', body_text: '...' })).toBe(true);
  });

  it('keeps articles that mention NVLink', () => {
    expect(isRelevant({ title: 'New NVLink fabric standard', body_text: '...' })).toBe(true);
  });

  it('checks first 500 chars of body if title is unrelated', () => {
    expect(isRelevant({
      title: 'Big tech news',
      body_text: 'Some preamble. Nvidia and AMD reported earnings today...'
    })).toBe(true);
  });

  it('rejects articles without any keyword', () => {
    expect(isRelevant({ title: 'AMD launches new product', body_text: 'Intel is doing things' })).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isRelevant({ title: 'NVIDIA news', body_text: '' })).toBe(true);
    expect(isRelevant({ title: 'nvidia news', body_text: '' })).toBe(true);
  });
});
