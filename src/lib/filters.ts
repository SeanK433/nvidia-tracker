import type { Relationship, Category, Confidence, Milestone } from './schema';

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

export function sortByLatestMilestone(rels: Relationship[]): Relationship[] {
  // Most recently active partnerships first. Falls back to last_confirmed
  // if a partner has no milestones (shouldn't happen post-seed, but defensive).
  const keyFor = (r: Relationship): string => {
    if (r.milestones && r.milestones.length > 0) {
      return r.milestones.reduce((acc, m) => (m.date > acc ? m.date : acc), '');
    }
    return r.last_confirmed;
  };
  return [...rels].sort((a, b) => keyFor(b).localeCompare(keyFor(a)));
}

export function latestMilestone(milestones: Milestone[]): Milestone | null {
  if (milestones.length === 0) return null;
  return [...milestones].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function recentMilestonesForHover(milestones: Milestone[]): Milestone[] {
  return [...milestones]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2);
}
