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

export const EvidenceEntrySchema = z.object({
  url: z.string().url(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
});

export const RelationshipSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase slug'),
  partner: z.string().min(1),
  category: CategorySchema,
  purpose: z.string().min(1),
  evidence_quote: z.string().max(200),
  evidence_url: z.string().url(),
  evidence_history: z.array(EvidenceEntrySchema),
  first_announced: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  last_confirmed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: StatusSchema,
  confidence: ConfidenceSchema,
  notes: z.string()
});

export type Relationship = z.infer<typeof RelationshipSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
