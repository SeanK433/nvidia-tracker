import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { RelationshipSchema, PendingProposalSchema, type Relationship, type PendingProposal } from './schema';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

export function loadRelationships(): Relationship[] {
  const raw = readFileSync(resolve(REPO_ROOT, 'data/relationships.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  return z.array(RelationshipSchema).parse(parsed);
}

export function loadPending(): PendingProposal[] {
  const raw = readFileSync(resolve(REPO_ROOT, 'data/pending.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  return z.array(PendingProposalSchema).parse(parsed);
}
