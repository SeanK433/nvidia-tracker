import { describe, it, expect } from 'vitest';
import { daysSince, parseExtractionDate, countPartnersNeedingSignificanceReview } from '../scripts/lib/extraction-status';
import type { Relationship } from '../src/lib/schema';

describe('parseExtractionDate', () => {
  it('parses "Week of YYYY-MM-DD" from a commit message', () => {
    expect(parseExtractionDate('Week of 2026-04-21: 3 updates')).toEqual(new Date('2026-04-21'));
  });

  it('returns null when no extraction marker', () => {
    expect(parseExtractionDate('chore: daily collection 2026-04-28')).toBe(null);
  });
});

describe('daysSince', () => {
  it('returns rounded day count', () => {
    const past = new Date('2026-04-21T00:00:00Z');
    const now = new Date('2026-04-28T00:00:00Z');
    expect(daysSince(past, now)).toBe(7);
  });

  it('returns 0 if same day', () => {
    const d = new Date('2026-04-28T00:00:00Z');
    expect(daysSince(d, d)).toBe(0);
  });
});

describe('countPartnersNeedingSignificanceReview', () => {
  const baseRel = (over: Partial<Relationship>): Relationship => ({
    id: 'x', partner: 'X', category: 'silicon',
    purpose: 'p', last_confirmed: '2026-04-01', status: 'active',
    confidence: 'high', notes: '',
    significance_tier: 'core',
    significance_narrative: 'narr',
    significance_reviewed_at: '2026-04-01',
    milestones: [{
      date: '2020-01-01', type: 'establishment',
      headline: 'h', description: 'd', url: 'https://x.com'
    }],
    ...over
  });

  it('counts partners with milestones added after their last review', () => {
    const rels = [
      baseRel({ id: 'a' }),
      baseRel({
        id: 'b',
        milestones: [
          { date: '2020-01-01', type: 'establishment', headline: 'h', description: 'd', url: 'https://x.com' },
          { date: '2026-04-15', type: 'expansion', headline: 'h2', description: 'd2', url: 'https://x.com/2' }
        ]
      })
    ];
    expect(countPartnersNeedingSignificanceReview(rels)).toBe(1);
  });

  it('returns 0 when no partner has new milestones', () => {
    expect(countPartnersNeedingSignificanceReview([baseRel({})])).toBe(0);
  });
});
