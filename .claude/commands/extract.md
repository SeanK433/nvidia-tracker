---
description: Process new raw articles into milestones for existing partners and proposals for new partners
---

# Weekly Extraction

You are running the weekly extraction for the Nvidia partnership tracker.

## Step 1: Read context

Read these files in order:
1. `CATEGORIES.md` — the rules for what counts as a partnership and the six categories
2. `extract_prompt.md` — the extraction process (REJECT / UPDATE / PROPOSE NEW)
3. `data/relationships.json` — currently tracked partnerships

## Step 2: Determine which raw articles are new

Run `git log --pretty=%s -n 200` and find the most recent commit with subject matching `Week of YYYY-MM-DD`. That's the cutoff.

Articles to process: every entry in `raw/*.json` files where `fetched_at` is AFTER the cutoff. If no prior extraction exists, process everything.

## Step 3: Classify each article

Per `extract_prompt.md`, classify as REJECT / UPDATE / PROPOSE NEW. Apply CATEGORIES.md rules strictly:
- Customers buying GPUs, resellers, conference sponsors → REJECT
- Competitors framed as partners (AMD, Cerebras, Groq) → REJECT
- Updates to existing partners → UPDATE (do not require human review)
- Genuinely new partnerships → PROPOSE NEW

## Step 4: Apply changes

### For UPDATEs

For each article classified as UPDATE for an existing partner, make a SECOND judgment:

- **Substantive milestone**: Article describes a NEW event in the partnership — a new product, an expansion of scope, a capital commitment, a customer deal, a new technology integration. Action:
  1. Append a new entry to that partner's `milestones[]` array with:
     - `date`: the article's `published_at` date.
     - `type`: one of `expansion` / `investment` / `product-launch` / `customer-win` (NOT `establishment` — that's reserved for the partnership's origin).
     - `headline`: 1-line summary of the event (≤ 100 chars).
     - `description`: 1–2 sentence elaboration (≤ 300 chars).
     - `url`: the article URL.
  2. Bump `last_confirmed` to the article date.
  3. Maintain chronological order in `milestones[]` (oldest first). Insert at the right position; usually the article date is newer than all existing entries so it goes at the end.

- **Bare confirmation**: Article merely re-mentions the partnership without new substance. Action: bump `last_confirmed` only. Do NOT add a milestone.

When in doubt, prefer adding a milestone (errs toward more data; you can edit later).

### For PROPOSE NEWs

Append to `data/pending.json` with all required new-shape fields. The skeleton must include:

```json
{
  "id": "<lowercase-slug>",
  "partner": "<Partner Name>",
  "category": "<one of 6>",
  "purpose": "<1-2 sentence description>",
  "last_confirmed": "<article date>",
  "status": "active",
  "confidence": "<high/medium/low>",
  "notes": "",
  "significance_tier": "<core/significant/ancillary — your judgment>",
  "significance_narrative": "<1-2 sentences explaining economic stakes for the partner>",
  "significance_reviewed_at": "<today's date>",
  "milestones": [
    {
      "date": "<earliest known partnership date — often the article date>",
      "type": "establishment",
      "headline": "<short>",
      "description": "<1-2 sentences>",
      "url": "<article url>"
    }
  ],
  "proposed_from_article": "<article url>"
}
```

**Auto-flag thin sourcing**: if you only have one source for the new partnership (the proposing article) and can't find corroboration via web search, set `confidence` to `medium` (not `high`) and append a one-line note: `Limited public sourcing — single article basis at proposal time.`

### For REJECTs

Append a one-line entry to `extraction_log.md`:

```
## YYYY-MM-DD article-id-prefix
Headline: ...
Decision: REJECT
Reason: [four-word reason]
```

## Step 5: Report and walk-through

Tell the user:
- Total articles processed
- Count of REJECTs, UPDATEs (split: substantive milestones added vs bare confirmations), and PROPOSEs
- For UPDATEs that added milestones: partner name + milestone headline
- Then ask: "Walk through the N new proposals?"

If they say yes, show each proposal one at a time:

```
Proposal X of N — Partner Name
─────────────────────────────
Category:                <cat>
Purpose:                 <purpose>
Source:                  <url> (date)
Confidence:              <high/medium/low>

Significance:
  tier:      <tier>
  narrative: <narrative>

Establishment milestone:
  <headline>
  <description>
  → <url>

[keep] [skip] [edit]
```

For each:
- `keep` → move from `data/pending.json` to `data/relationships.json`. Strip `proposed_from_article`.
- `skip` → remove from `data/pending.json`, append to `extraction_log.md` with the user's reason.
- `edit "<change>"` → apply the described change, then ask again.

## Step 6: Commit

After all proposals reviewed, run validation:

```
npm run validate-data
```

Then commit everything in one commit with this format:

```
Week of YYYY-MM-DD: N updates, M new partners

Added:
  - Partner Name (category)
  - ...
Updated (substantive):
  - Partner1: <new milestone headline>
  - Partner2: <new milestone headline>
Updated (confirmation only):
  - Partner3, Partner4, ...
Rejected: K articles (see extraction_log.md)
```

The phrase "Week of YYYY-MM-DD" is required — the reminder script parses it.
