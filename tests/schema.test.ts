import { describe, it, expect } from 'vitest';
import { RelationshipSchema } from '../src/lib/schema';

describe('RelationshipSchema', () => {
  it('accepts a valid relationship', () => {
    const valid = {
      id: 'tsmc',
      partner: 'TSMC',
      category: 'silicon',
      purpose: 'Manufactures Nvidia GPUs',
      evidence_quote: 'TSMC partners with Nvidia',
      evidence_url: 'https://example.com',
      evidence_history: [{ url: 'https://example.com', date: '2026-04-15' }],
      first_announced: '2020-01-01',
      last_confirmed: '2026-04-15',
      status: 'active',
      confidence: 'high',
      notes: ''
    };
    expect(() => RelationshipSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid category', () => {
    const invalid = { id: 'x', partner: 'X', category: 'bogus' };
    expect(() => RelationshipSchema.parse(invalid)).toThrow();
  });

  it('rejects a non-slug id', () => {
    const invalid = {
      id: 'TSMC',
      partner: 'TSMC',
      category: 'silicon',
      purpose: 'x',
      evidence_quote: 'x',
      evidence_url: 'https://x.com',
      evidence_history: [],
      first_announced: '2020-01-01',
      last_confirmed: '2026-04-15',
      status: 'active',
      confidence: 'high',
      notes: ''
    };
    expect(() => RelationshipSchema.parse(invalid)).toThrow();
  });
});
