import type { Relationship, Category, Confidence } from './schema';

export function filterActive(rels: Relationship[]): Relationship[] {
  return rels.filter((r) => r.status === 'active');
}

export function filterByCategory(rels: Relationship[], category: Category | null): Relationship[] {
  if (category === null) return rels;
  return rels.filter((r) => r.category === category);
}

export function filterByConfidence(rels: Relationship[], confidence: Confidence): Relationship[] {
  return rels.filter((r) => r.confidence === confidence);
}

export function groupByCategory(rels: Relationship[]): Partial<Record<Category, Relationship[]>> {
  const out: Partial<Record<Category, Relationship[]>> = {};
  for (const r of rels) {
    (out[r.category] ??= []).push(r);
  }
  return out;
}

export function sortByPartner(rels: Relationship[]): Relationship[] {
  return [...rels].sort((a, b) =>
    a.partner.toLowerCase().localeCompare(b.partner.toLowerCase())
  );
}

export function sortByLastConfirmed(rels: Relationship[]): Relationship[] {
  return [...rels].sort((a, b) => b.last_confirmed.localeCompare(a.last_confirmed));
}
