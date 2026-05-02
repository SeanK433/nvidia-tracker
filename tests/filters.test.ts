import { describe, it, expect } from 'vitest';
import {
  filterActive,
  filterByCategory,
  filterByConfidence,
  groupByCategory,
  sortByPartner,
  sortByLastConfirmed,
  sortByLatestMilestone,
  latestMilestone,
  recentMilestonesForHover
} from '../src/lib/filters';
import type { Relationship, Milestone } from '../src/lib/schema';

const milestone = (date: string, type: Milestone['type'] = 'establishment'): Milestone => ({
  date, type,
  headline: 'h', description: 'd',
  url: 'https://example.com'
});

const sample: Relationship[] = [
  {
    id: 'tsmc', partner: 'TSMC', category: 'silicon',
    purpose: 'foundry',
    last_confirmed: '2026-04-15', status: 'active', confidence: 'high', notes: '',
    significance_tier: 'core',
    significance_narrative: 'Foundry partner.',
    significance_reviewed_at: '2026-05-02',
    milestones: [milestone('2020-01-01')]
  },
  {
    id: 'nebius', partner: 'Nebius', category: 'cloud',
    purpose: 'gpu cloud',
    last_confirmed: '2026-03-10', status: 'active', confidence: 'medium', notes: '',
    significance_tier: 'significant',
    significance_narrative: 'GPU cloud platform.',
    significance_reviewed_at: '2026-05-02',
    milestones: [milestone('2024-01-01')]
  },
  {
    id: 'old-corp', partner: 'OldCorp', category: 'silicon',
    purpose: 'historic',
    last_confirmed: '2024-01-01', status: 'dormant', confidence: 'low', notes: '',
    significance_tier: 'ancillary',
    significance_narrative: 'Historic partner.',
    significance_reviewed_at: '2026-05-02',
    milestones: [milestone('2018-01-01')]
  }
];

describe('filterActive', () => {
  it('keeps only active entries', () => {
    expect(filterActive(sample).map(r => r.id)).toEqual(['tsmc', 'nebius']);
  });
});

describe('filterByCategory', () => {
  it('keeps only the specified category', () => {
    expect(filterByCategory(sample, 'silicon').map(r => r.id)).toEqual(['tsmc', 'old-corp']);
  });

  it('returns all when category is null', () => {
    expect(filterByCategory(sample, null).length).toBe(3);
  });
});

describe('filterByConfidence', () => {
  it('keeps only the specified confidence', () => {
    expect(filterByConfidence(sample, 'high').map(r => r.id)).toEqual(['tsmc']);
  });
});

describe('groupByCategory', () => {
  it('groups relationships by category, returning a Record<Category, Relationship[]>', () => {
    const grouped = groupByCategory(sample);
    expect(grouped.silicon?.map(r => r.id)).toEqual(['tsmc', 'old-corp']);
    expect(grouped.cloud?.map(r => r.id)).toEqual(['nebius']);
  });
});

describe('sortByPartner', () => {
  it('sorts alphabetically by partner name (case-insensitive)', () => {
    expect(sortByPartner(sample).map(r => r.partner)).toEqual(['Nebius', 'OldCorp', 'TSMC']);
  });
});

describe('sortByLastConfirmed', () => {
  it('sorts by last_confirmed descending (most recent first)', () => {
    expect(sortByLastConfirmed(sample).map(r => r.id)).toEqual(['tsmc', 'nebius', 'old-corp']);
  });
});

describe('sortByLatestMilestone', () => {
  it('sorts by each partner\'s most recent milestone date, newest first', () => {
    expect(sortByLatestMilestone(sample).map(r => r.id)).toEqual(['nebius', 'tsmc', 'old-corp']);
  });
});

const ms = (date: string, type: Milestone['type'], headline: string): Milestone => ({
  date,
  type,
  headline,
  description: 'desc',
  url: 'https://example.com'
});

describe('latestMilestone', () => {
  it('returns the most recent milestone by date', () => {
    const milestones = [
      ms('2020-01-01', 'establishment', 'Start'),
      ms('2024-06-15', 'expansion', 'Mid'),
      ms('2025-12-10', 'expansion', 'Latest')
    ];
    expect(latestMilestone(milestones)?.headline).toBe('Latest');
  });

  it('returns null for empty array', () => {
    expect(latestMilestone([])).toBe(null);
  });

  it('returns the only entry for length-1 arrays', () => {
    const only = [ms('2020-01-01', 'establishment', 'Only')];
    expect(latestMilestone(only)?.headline).toBe('Only');
  });
});

describe('recentMilestonesForHover', () => {
  it('returns up to 2 most recent milestones', () => {
    const milestones = [
      ms('2020-01-01', 'establishment', 'Start'),
      ms('2024-06-15', 'expansion', 'Mid'),
      ms('2025-12-10', 'expansion', 'Latest')
    ];
    const recent = recentMilestonesForHover(milestones);
    expect(recent.map(m => m.headline)).toEqual(['Latest', 'Mid']);
  });

  it('returns establishment as fallback when only 1 milestone exists', () => {
    const only = [ms('2020-01-01', 'establishment', 'Only')];
    expect(recentMilestonesForHover(only).map(m => m.headline)).toEqual(['Only']);
  });

  it('returns empty array for empty input', () => {
    expect(recentMilestonesForHover([])).toEqual([]);
  });
});
