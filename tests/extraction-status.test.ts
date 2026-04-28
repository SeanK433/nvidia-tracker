import { describe, it, expect } from 'vitest';
import { daysSince, parseExtractionDate } from '../scripts/lib/extraction-status';

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
