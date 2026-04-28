# Extraction Prompt

Paste this into a Claude Code session along with the week's `raw/` JSON files. The goal is structured extraction with explicit uncertainty, not confident classification.

---

## Prompt

You are processing raw articles for an Nvidia partnership tracker. Read `CATEGORIES.md` in this repo first — it defines what counts as a partnership, the six categories, the required fields, and the confidence rubric. Apply those rules strictly.

For each article in the provided `raw/` files, do exactly one of three things:

### 1. REJECT — most articles
Most articles mentioning Nvidia are not partnership announcements. Reject without ceremony if the article is:
- A product launch with no named partner
- Earnings coverage, stock analysis, or financial commentary
- A customer purchase that doesn't meet the partnership bar in `CATEGORIES.md`
- A rumor, leak, or "people familiar with the matter" story
- A conference recap without specific new partnerships named
- Coverage of a partnership already in `relationships.json` with no new information

Output for rejects: one line in `extraction_log.md` with the article ID, headline, and a four-word reason. Nothing more.

### 2. UPDATE — existing partnerships
If the article confirms or extends a relationship already in `relationships.json`:
- Update `last_confirmed` to the article date
- Append the URL to an `evidence_history` array (create if missing)
- Update `purpose` only if the article materially changes the scope — and note the change in `notes` with the date
- Do not change `first_announced`, `category`, or `confidence` without explicit reasoning in `extraction_log.md`

### 3. PROPOSE NEW — genuine new partnerships
If the article describes a new partnership meeting the `CATEGORIES.md` bar, propose an entry. Do not write it to `relationships.json` directly — write proposals to `data/pending.json` for review.

Each proposal must include every required field from `CATEGORIES.md`. For fields you cannot determine from the article alone, write `"UNKNOWN"` rather than guessing. Common unknowns:
- `first_announced` when the article references a prior agreement without dating it
- `purpose` when the announcement is vague ("strategic collaboration on AI")

If `purpose` would be vague, that's a signal the article may not clear the partnership bar. Reconsider rejecting.

## Hard rules

- **Never invent a partnership** that isn't explicitly stated in the source. If you're inferring from context, stop.
- **Never upgrade confidence** based on multiple low-quality sources reporting the same thing. Confidence comes from source authority, not source count.
- **Never quote more than 15 words** from any source. Paraphrase the purpose; reserve quoting for `evidence_quote`.
- **Flag competitor confusion explicitly.** If an article frames a company as a partner but you know that company competes with Nvidia (e.g., Groq, Cerebras, AMD, Tenstorrent making their own AI chips), reject and note in the log: `competitor not partner`. Customer-supplier and partner-competitor relationships often blur in press coverage.
- **Distinguish announcement from execution.** "Plans to," "will explore," "intends to" are weaker signals than "is shipping," "has deployed," "is manufacturing." Reflect this in `confidence`.
- **One article rarely justifies high confidence on its own.** High confidence usually requires Nvidia's official channel plus partner confirmation. A single trade press article is medium at best.

## Output format

At the end of the session, produce:

1. **`data/pending.json`** — array of new proposals, ready for human review
2. **`extraction_log.md`** (append, don't overwrite) — one section per article processed:
   ```
   ## [date] [article_id]
   Headline: ...
   Decision: REJECT | UPDATE | PROPOSE
   Reason / changes: one or two sentences
   ```
3. **`extraction_summary.md`** (overwrite each session) — counts of REJECT / UPDATE / PROPOSE, list of partnerships needing re-confirmation (any `active` entry with `last_confirmed` over 9 months ago), and any judgment calls you're unsure about.

## Self-check before finishing

Before you hand back the output, answer these in `extraction_summary.md`:

1. Did I propose anything where the partner is actually a competitor? Re-check.
2. Did I propose anything based on a single rumor-tier source? Downgrade or reject.
3. Did I update `purpose` on an existing entry? If yes, is the change reflected in `notes`?
4. Are there `active` entries I've now seen no evidence of for 12+ months? List them for dormant review.
5. Did any of my proposals require me to fill `purpose` with vague language? Reconsider those.

If any answer worries you, flag it explicitly — don't bury it.
