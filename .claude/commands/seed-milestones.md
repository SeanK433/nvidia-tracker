---
description: One-time backfill of milestones, significance tier, and significance narrative for all existing partners
---

# Seed Milestones

You are running a ONE-TIME interactive migration that adds structured milestones and significance fields to every partner in `data/relationships.json`. After this command finishes for all partners, the data file will have new fields populated alongside the existing old fields. (A later cleanup step strips the old fields.)

## Step 1: Read context

1. `docs/superpowers/specs/2026-05-02-milestones-and-significance-design.md` — the design spec
2. `CATEGORIES.md` — partnership taxonomy
3. `data/relationships.json` — current partners (read full file)

## Step 2: Refuse if already seeded

If ANY partner in `relationships.json` already has a populated `milestones` array, STOP and tell the user:

> "/seed-milestones has already been run for at least one partner. Refusing to proceed to avoid clobbering existing data. Run /review-significance for ongoing updates."

Do not modify the file in this case.

## Step 3: For each partner, draft new fields

For each partner (process in the order they appear in `relationships.json`):

1. Read the partner's existing `notes`, `evidence_url`, `evidence_quote`, `evidence_history`, and `first_announced`.
2. Run TWO targeted web searches:
   - `"$PARTNER NVIDIA partnership timeline"`
   - `"$PARTNER NVIDIA revenue exposure"` (or `"$PARTNER AI revenue"` for context on significance)
3. Synthesize:
   - **At minimum, one establishment milestone**: date = `first_announced`, type = `establishment`, url = `evidence_url`, headline + description synthesized from `notes` and the existing evidence quote.
   - **Additional milestones** (if identifiable): expansion / investment / product-launch / customer-win events found in `notes`, `evidence_history` URLs, or web search results. Each milestone MUST have a real source URL; do not fabricate.
   - **`significance_tier`**: `core` / `significant` / `ancillary` based on partner size and relationship economic exposure (Marvell/CoreWeave-scale = often `core`; Samsung/Microsoft-scale = often `ancillary`).
   - **`significance_narrative`**: 1–2 sentences (≤ 280 chars) explaining the economic stakes — what % of partner revenue / which business line / what's at stake.
   - **`significance_reviewed_at`**: today's date.

4. **Auto-flag thin sourcing**: if you couldn't find adequate public sources for the partner's expansion history (only the establishment is sourceable), DOWNGRADE the partner's `confidence` field by one step (`high` → `medium`, or `medium` → `low`) and APPEND a one-line note to `notes`: `Limited public expansion sourcing — milestone coverage may be incomplete.`

## Step 4: Walk user through each partner

Show the draft for one partner at a time:

```
[N of 28] Partner Name
─────────────────────────
significance_tier:      core
significance_narrative: <draft text>

milestones (3):
  1. 2020-01-01  establishment  TSMC selected as Nvidia foundry partner
     <description>
     → <url>
  2. 2024-03-18  expansion      Blackwell production ramps on N4
     <description>
     → <url>
  3. 2025-12-10  expansion      60% of CoWoS capacity secured through 2026-27
     <description>
     → <url>

confidence: high (unchanged)
notes: <unchanged>

[keep] [skip] [edit] [rerun]
```

For each:
- `keep` → write the new fields to the partner's record in `relationships.json`. Do NOT remove old fields.
- `skip` → don't modify this partner. Move on.
- `edit "<change>"` → apply the user's change, re-show.
- `rerun` → redo the web research and draft from scratch.

Save partner-by-partner so the run is interruptible.

## Step 5: Commit

After all partners are processed, run validation:

```bash
npm run validate-data
```

Then commit:

```
git add data/relationships.json
git commit -m "data: seed milestones and significance for all partners

Additive migration: adds milestones[], significance_tier,
significance_narrative, significance_reviewed_at to every partner.
Old fields (evidence_history, evidence_url, evidence_quote,
first_announced) are preserved — they will be removed in the
Phase 4 cleanup commit."
```
