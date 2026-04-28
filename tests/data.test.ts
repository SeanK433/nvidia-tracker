import { describe, it, expect } from 'vitest';
import { loadRelationships, loadPending } from '../src/lib/data';

describe('loadRelationships', () => {
  it('loads and validates the relationships file', () => {
    const result = loadRelationships();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('loadPending', () => {
  it('loads and validates the pending file', () => {
    const result = loadPending();
    expect(Array.isArray(result)).toBe(true);
  });
});
