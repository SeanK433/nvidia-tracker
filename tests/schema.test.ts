import { describe, it, expect } from 'vitest';
import {
  RelationshipSchema,
  PendingProposalSchema,
  ArticleSchema,
  RawFileSchema,
  MilestoneSchema,
  SignificanceTierSchema
} from '../src/lib/schema';

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

describe('PendingProposalSchema', () => {
  it('accepts a relationship plus proposed_from_article', () => {
    const valid = {
      id: 'astera-labs',
      partner: 'Astera Labs',
      category: 'interconnect',
      purpose: 'NVLink Fusion ecosystem partner',
      evidence_quote: 'Astera Labs joins NVLink Fusion',
      evidence_url: 'https://blogs.nvidia.com/x',
      evidence_history: [],
      first_announced: '2026-04-22',
      last_confirmed: '2026-04-22',
      status: 'active',
      confidence: 'high',
      notes: '',
      proposed_from_article: 'https://blogs.nvidia.com/x'
    };
    expect(() => PendingProposalSchema.parse(valid)).not.toThrow();
  });

  it('rejects without proposed_from_article', () => {
    const invalid = { id: 'x', partner: 'X' };
    expect(() => PendingProposalSchema.parse(invalid)).toThrow();
  });
});

describe('ArticleSchema', () => {
  it('accepts a valid article', () => {
    const valid = {
      id: 'a'.repeat(64),
      url: 'https://example.com/x',
      title: 'Some headline',
      published_at: '2026-04-27',
      source: 'nvidia-newsroom',
      body_text: 'The article body...'
    };
    expect(() => ArticleSchema.parse(valid)).not.toThrow();
  });

  it('rejects a short id (must be sha256 hex)', () => {
    const invalid = {
      id: 'short',
      url: 'https://x.com',
      title: 'x',
      published_at: '2026-04-27',
      source: 'x',
      body_text: 'x'
    };
    expect(() => ArticleSchema.parse(invalid)).toThrow();
  });
});

describe('RawFileSchema', () => {
  it('accepts a valid raw file with multiple articles', () => {
    const valid = {
      fetched_at: '2026-04-28T11:00:00Z',
      articles: [
        {
          id: 'a'.repeat(64),
          url: 'https://x.com/1',
          title: 'one',
          published_at: '2026-04-27',
          source: 'rss-x',
          body_text: 'body 1'
        }
      ]
    };
    expect(() => RawFileSchema.parse(valid)).not.toThrow();
  });
});

describe('MilestoneSchema', () => {
  const valid = {
    date: '2025-12-10',
    type: 'expansion' as const,
    headline: '60% of CoWoS capacity secured through 2026-27',
    description: 'TSMC reserved the bulk of advanced packaging capacity for Nvidia products.',
    url: 'https://example.com/article'
  };

  it('accepts a valid milestone', () => {
    expect(() => MilestoneSchema.parse(valid)).not.toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => MilestoneSchema.parse({ ...valid, type: 'bogus' })).toThrow();
  });

  it('rejects headline > 100 chars', () => {
    expect(() => MilestoneSchema.parse({ ...valid, headline: 'x'.repeat(101) })).toThrow();
  });

  it('rejects description > 300 chars', () => {
    expect(() => MilestoneSchema.parse({ ...valid, description: 'x'.repeat(301) })).toThrow();
  });

  it('rejects malformed date', () => {
    expect(() => MilestoneSchema.parse({ ...valid, date: '2025/12/10' })).toThrow();
  });

  it('rejects non-URL source', () => {
    expect(() => MilestoneSchema.parse({ ...valid, url: 'not-a-url' })).toThrow();
  });
});

describe('SignificanceTierSchema', () => {
  it('accepts core, significant, ancillary', () => {
    expect(() => SignificanceTierSchema.parse('core')).not.toThrow();
    expect(() => SignificanceTierSchema.parse('significant')).not.toThrow();
    expect(() => SignificanceTierSchema.parse('ancillary')).not.toThrow();
  });

  it('rejects other values', () => {
    expect(() => SignificanceTierSchema.parse('high')).toThrow();
  });
});

describe('RelationshipSchema with optional new fields', () => {
  const base = {
    id: 'tsmc',
    partner: 'TSMC',
    category: 'silicon' as const,
    purpose: 'Foundry partnership',
    evidence_quote: 'q',
    evidence_url: 'https://example.com',
    evidence_history: [],
    first_announced: '2020-01-01',
    last_confirmed: '2026-04-15',
    status: 'active' as const,
    confidence: 'high' as const,
    notes: ''
  };

  it('accepts a relationship with no new fields (backward compat)', () => {
    expect(() => RelationshipSchema.parse(base)).not.toThrow();
  });

  it('accepts a relationship with new fields populated', () => {
    const enriched = {
      ...base,
      significance_tier: 'core',
      significance_narrative: 'TSMC is the sole leading-edge foundry for Nvidia GPUs; this relationship is core to TSMC\'s revenue growth.',
      significance_reviewed_at: '2026-05-02',
      milestones: [
        {
          date: '2020-01-01',
          type: 'establishment',
          headline: 'TSMC selected as Nvidia foundry partner',
          description: 'TSMC began producing Nvidia leading-edge GPUs.',
          url: 'https://example.com/tsmc-establishment'
        }
      ]
    };
    expect(() => RelationshipSchema.parse(enriched)).not.toThrow();
  });

  it('rejects significance_narrative > 280 chars', () => {
    expect(() => RelationshipSchema.parse({
      ...base,
      significance_narrative: 'x'.repeat(281)
    })).toThrow();
  });
});
