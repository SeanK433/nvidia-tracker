---
description: Process new raw articles into relationships.json and pending.json
---

# Weekly Extraction

You are running the weekly extraction for this Nvidia partnership tracker.

## Step 1: Read context

Read these files in order:
1. `CATEGORIES.md` — the rules for what counts as a partnership and the six categories
2. `extract_prompt.md` — the extraction process (REJECT / UPDATE / PROPOSE NEW)
3. `data/relationships.json` — currently tracked partnerships (do NOT load if huge; sample is fine)

## Step 2: Determine which raw articles are new

Run `git log --pretty=%s -n 200` and find the most recent commit with subject matching `Week of YYYY-MM-DD`. That's the cutoff.

Articles to process: every entry in `raw/*.json` files where `fetched_at` is AFTER the cutoff. If no prior extraction exists, process everything.

## Step 3: Classify each article

Per `extract_prompt.md`, classify as REJECT / UPDATE / PROPOSE NEW. Apply CATEGORIES.md rules strictly. In particular:
- Customers buying GPUs, resellers, conference sponsors → REJECT
- Competitors framed as partners (AMD, Cerebras, Groq) → REJECT with "competitor not partner"
- Updates to existing partners → UPDATE (do not require human review)
- Genuinely new partnerships → PROPOSE NEW

## Step 4: Apply changes

**For UPDATEs**, edit `data/relationships.json` directly:
- Append to `evidence_history`: `{ "url": "...", "date": "YYYY-MM-DD" }`
- Update `last_confirmed` to the article date

**For PROPOSE NEWs**, append to `data/pending.json` with all required fields plus `proposed_from_article` (the article URL).

**For REJECTs**, append a one-line entry to `extraction_log.md`:
```
## YYYY-MM-DD article-id-prefix
Headline: ...
Decision: REJECT
Reason: [four-word reason]
```

## Step 5: Report and walk-through

Tell the user:
- Total articles processed
- Count of REJECTs, UPDATEs, PROPOSEs
- Updated partner names
- Then ask: "Walk through the N new proposals?"

If they say yes, show each proposal one at a time:
```
Proposal X of N — Partner Name
─────────────────────────────
Category: ...
Purpose:  ...
Source:   url (date)
Quote:    "..."
Confidence: high/medium/low

[keep] [skip] [edit]
```

For each:
- `keep` → move from `data/pending.json` to `data/relationships.json`. Generate `id` as the lowercase slug of the partner name (replace spaces and `&` with `-`). Initialize `evidence_history` with the source URL and date.
- `skip` → remove from `data/pending.json`, append to `extraction_log.md` with the user's reason
- `edit "<change>"` → apply the described change, then ask again

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
Updated:
  - Partner1, Partner2, ...
Rejected: K articles (see extraction_log.md)
```

The phrase "Week of YYYY-MM-DD" is required — the reminder script parses it.
