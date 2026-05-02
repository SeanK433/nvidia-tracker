import { describe, it, expect } from 'vitest';
import {
  RelationshipSchema,
  PendingProposalSchema,
  ArticleSchema,
  RawFileSchema,
  MilestoneSchema,
  SignificanceTierSchema
} from '../src/lib/schema';

const validMilestone = {
  date: '2020-01-01',
  type: 'establishment' as const,
  headline: 'TSMC selected as Nvidia foundry partner',
  description: 'TSMC began producing Nvidia leading-edge GPUs.',
  url: 'https://example.com/tsmc-establishment'
};

const validRelationship = {
  id: 'tsmc',
  partner: 'TSMC',
  category: 'silicon' as const,
  purpose: 'Foundry partnership',
  last_confirmed: '2026-04-15',
  status: 'active' as const,
  confidence: 'high' as const,
  notes: '',
  significance_tier: 'core' as const,
  significance_narrative: 'TSMC manufactures all leading-edge Nvidia GPUs.',
  significance_reviewed_at: '2026-05-02',
  milestones: [validMilestone]
};

describe('RelationshipSchema (strict shape)', () => {
  it('accepts a fully-populated relationship', () => {
    expect(() => RelationshipSchema.parse(validRelationship)).not.toThrow();
  });

  it('rejects an invalid category', () => {
    expect(() => RelationshipSchema.parse({ ...validRelationship, category: 'bogus' })).toThrow();
  });

  it('rejects a non-slug id', () => {
    expect(() => RelationshipSchema.parse({ ...validRelationship, id: 'TSMC' })).toThrow();
  });

  it('rejects when milestones is empty', () => {
    expect(() => RelationshipSchema.parse({ ...validRelationship, milestones: [] })).toThrow();
  });

  it('rejects when there is no establishment milestone', () => {
    expect(() => RelationshipSchema.parse({
      ...validRelationship,
      milestones: [{ ...validMilestone, type: 'expansion' }]
    })).toThrow();
  });

  it('rejects when there are multiple establishment milestones', () => {
    expect(() => RelationshipSchema.parse({
      ...validRelationship,
      milestones: [
        validMilestone,
        { ...validMilestone, date: '2021-01-01' }
      ]
    })).toThrow();
  });

  it('rejects when milestones are out of chronological order', () => {
    expect(() => RelationshipSchema.parse({
      ...validRelationship,
      milestones: [
        { ...validMilestone, date: '2025-01-01', type: 'expansion' as const },
        { ...validMilestone, date: '2020-01-01' }
      ]
    })).toThrow();
  });

  it('rejects significance_narrative > 280 chars', () => {
    expect(() => RelationshipSchema.parse({
      ...validRelationship,
      significance_narrative: 'x'.repeat(281)
    })).toThrow();
  });

  it('rejects when significance_tier is missing', () => {
    const { significance_tier, ...withoutTier } = validRelationship;
    expect(() => RelationshipSchema.parse(withoutTier)).toThrow();
  });
});

describe('PendingProposalSchema', () => {
  it('accepts a relationship plus proposed_from_article', () => {
    const valid = {
      ...validRelationship,
      id: 'astera-labs',
      partner: 'Astera Labs',
      category: 'interconnect' as const,
      proposed_from_article: 'https://blogs.nvidia.com/x'
    };
    expect(() => PendingProposalSchema.parse(valid)).not.toThrow();
  });

  it('rejects without proposed_from_article', () => {
    expect(() => PendingProposalSchema.parse(validRelationship)).toThrow();
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
  it('accepts a valid milestone', () => {
    expect(() => MilestoneSchema.parse(validMilestone)).not.toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => MilestoneSchema.parse({ ...validMilestone, type: 'bogus' })).toThrow();
  });

  it('rejects headline > 100 chars', () => {
    expect(() => MilestoneSchema.parse({ ...validMilestone, headline: 'x'.repeat(101) })).toThrow();
  });

  it('rejects description > 300 chars', () => {
    expect(() => MilestoneSchema.parse({ ...validMilestone, description: 'x'.repeat(301) })).toThrow();
  });

  it('rejects malformed date', () => {
    expect(() => MilestoneSchema.parse({ ...validMilestone, date: '2025/12/10' })).toThrow();
  });

  it('rejects non-URL source', () => {
    expect(() => MilestoneSchema.parse({ ...validMilestone, url: 'not-a-url' })).toThrow();
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
