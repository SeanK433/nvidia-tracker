import { z } from 'zod';
import { RelationshipSchema, PendingProposalSchema, type Relationship, type PendingProposal } from './schema';
import relationshipsJson from '../../data/relationships.json';
import pendingJson from '../../data/pending.json';

export function loadRelationships(): Relationship[] {
  return z.array(RelationshipSchema).parse(relationshipsJson);
}

export function loadPending(): PendingProposal[] {
  return z.array(PendingProposalSchema).parse(pendingJson);
}
