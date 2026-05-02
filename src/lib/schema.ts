import { z } from 'zod';

export const CategorySchema = z.enum([
  'silicon',
  'interconnect',
  'cloud',
  'software',
  'vertical',
  'investment'
]);

export const StatusSchema = z.enum(['active', 'dormant', 'ended']);

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const MilestoneTypeSchema = z.enum([
  'establishment',
  'expansion',
  'investment',
  'product-launch',
  'customer-win'
]);

export const MilestoneSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: MilestoneTypeSchema,
  headline: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  url: z.string().url()
});

export type Milestone = z.infer<typeof MilestoneSchema>;
export type MilestoneType = z.infer<typeof MilestoneTypeSchema>;

export const SignificanceTierSchema = z.enum(['core', 'significant', 'ancillary']);
export type SignificanceTier = z.infer<typeof SignificanceTierSchema>;

export const RelationshipSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase slug'),
  partner: z.string().min(1),
  category: CategorySchema,
  purpose: z.string().min(1),
  last_confirmed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: StatusSchema,
  confidence: ConfidenceSchema,
  notes: z.string(),
  significance_tier: SignificanceTierSchema,
  significance_narrative: z.string().min(1).max(280),
  significance_reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  milestones: z.array(MilestoneSchema)
    .min(1, 'every partner must have at least one milestone')
    .refine(
      arr => arr.filter(m => m.type === 'establishment').length === 1,
      'must contain exactly one establishment milestone'
    )
    .refine(
      arr => arr.every((m, i) => i === 0 || m.date >= arr[i - 1].date),
      'milestones must be in chronological order (oldest first)'
    )
});

export type Relationship = z.infer<typeof RelationshipSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const PendingProposalSchema = RelationshipSchema.extend({
  proposed_from_article: z.string().url()
});
export type PendingProposal = z.infer<typeof PendingProposalSchema>;

export const ArticleSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/, 'id must be sha256 hex'),
  url: z.string().url(),
  title: z.string().min(1),
  published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().min(1),
  body_text: z.string()
});
export type Article = z.infer<typeof ArticleSchema>;

export const RawFileSchema = z.object({
  fetched_at: z.string().datetime(),
  articles: z.array(ArticleSchema)
});
export type RawFile = z.infer<typeof RawFileSchema>;
