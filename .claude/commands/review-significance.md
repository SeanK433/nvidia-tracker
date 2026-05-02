---
description: Re-evaluate significance tier and narrative for partners with new milestones
---

# Significance Review

You are running an on-demand review of `significance_tier` and `significance_narrative` for partners whose milestones list has grown since their last review.

## Step 1: Read context

1. `data/relationships.json` — all partners

## Step 2: Identify partners that need review

For each partner, find milestones added since `significance_reviewed_at`:

```typescript
const newMilestones = partner.milestones.filter(m => m.date > partner.significance_reviewed_at);
```

If `newMilestones` is empty → SKIP this partner silently.

If `newMilestones` is non-empty → queue for review.

If no partners are queued, report `No partners need review` and exit cleanly.

## Step 3: For each queued partner, draft an update

Re-read the partner's full milestones list, current `significance_tier`, and current `significance_narrative`. Draft a new version:

- **`significance_tier`**: usually preserve. Only change with a strong articulable reason (e.g., a $2B investment that materially shifts how meaningful the relationship is to the partner). Default = preserve.
- **`significance_narrative`**: update to incorporate the new milestones. Aim for 1–2 sentences (≤ 280 chars).

If the draft equals the current values (no meaningful change), SKIP without showing the user.

## Step 4: Walk user through changed partners

For each partner where the draft differs from current:

```
[N of M] Partner Name
─────────────────────────
New milestones since last review (3):
  - 2025-12-10  expansion  60% of CoWoS capacity secured
  - ...

Current tier:      core
Proposed tier:     core (unchanged)

Current narrative:
  <existing narrative>

Proposed narrative:
  <new narrative>

[keep] [skip] [edit]
```

For each:
- `keep` → write the updated `significance_tier` and `significance_narrative` to the partner. Bump `significance_reviewed_at` to today.
- `skip` → leave the partner unchanged but STILL bump `significance_reviewed_at` to today (so we don't keep proposing the same change).
- `edit "<change>"` → apply, re-show.

## Step 5: Commit

After all queued partners are reviewed, run validation:

```
npm run validate-data
```

Then commit:

```
Significance review YYYY-MM-DD: N partners updated

Updated:
  - Partner1: <one-line summary of narrative change>
  - ...
```
