# Milestones and Significance — Design

**Date:** 2026-05-02
**Status:** Draft for implementation
**Project:** NVIDIA Tracker

---

## Summary

Adds two new dimensions to every partnership in the tracker:

1. **A structured timeline of partnership events** (milestones), replacing the current flat `evidence_history` list with rich, typed entries that capture what happened, when, and why it mattered.
2. **A significance indicator** — both a glanceable tier (`core` / `significant` / `ancillary`) and a 1–2 sentence narrative — that expresses how material the NVIDIA partnership is to each partner's overall business.

Both fields are populated and maintained by Claude through three slash commands. The hover card, list page, and detail page are redesigned to surface the new data.

---

## Goals

- Capture establishment dates and major announcements/expansions for every partnership in a structured form rather than the current ad-hoc prose in `notes`.
- Express how economically meaningful the NVIDIA relationship is to each partner — recognizing that the same partnership can be *transformative* for a smaller company (e.g., Marvell) and *ancillary* for a larger one (e.g., Samsung).
- Integrate this richer data into the existing UI without disrupting the clean, paper-and-ink visual aesthetic.
- Keep the maintenance burden on the user low — Claude does the writing, the user reviews.

---

## Non-goals

- No quantitative significance scoring (revenue %, market-cap-weighted, stock reaction). All signal is qualitative tier + narrative.
- No mobile optimization (current site isn't optimized for mobile; we keep the 260px hover card with a `max-width: 90vw` fallback for tiny viewports and revisit later).
- No graph-level visual indicators for significance — the graph stays clean. Significance shows in hover/list/detail only.
- No automatic significance tier changes during weekly `/extract` — that's deferred to the manual `/review-significance` command.

---

## Schema changes

### New `Relationship` shape

```typescript
{
  id: string,
  partner: string,
  category: 'silicon' | 'interconnect' | 'cloud' | 'software' | 'vertical' | 'investment',
  purpose: string,
  status: 'active' | 'dormant' | 'ended',
  confidence: 'high' | 'medium' | 'low',
  notes: string,
  last_confirmed: string,                              // YYYY-MM-DD; bumped by /extract on any UPDATE article

  // NEW:
  significance_tier: 'core' | 'significant' | 'ancillary',
  significance_narrative: string,                       // 1–2 sentences, ≤ 280 chars
  significance_reviewed_at: string,                     // YYYY-MM-DD; when /review-significance last touched this partner
  milestones: Milestone[],                              // chronological (oldest first); must contain exactly one with type='establishment'

  // REMOVED — replaced by milestones:
  // - evidence_quote
  // - evidence_url
  // - evidence_history
  // - first_announced (derived from milestones[0].date when milestones[0].type === 'establishment')
}

Milestone = {
  date: string,                                         // YYYY-MM-DD
  type: 'establishment' | 'expansion' | 'investment' | 'product-launch' | 'customer-win',
  headline: string,                                     // ≤ 100 chars, single line
  description: string,                                  // ≤ 300 chars, 1–2 sentences
  url: string                                           // source URL — required
}
```

### Zod validation rules

```typescript
RelationshipSchema = z.object({
  // ... existing unchanged fields ...
  significance_tier: z.enum(['core', 'significant', 'ancillary']),
  significance_narrative: z.string().min(1).max(280),
  significance_reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  milestones: z.array(MilestoneSchema)
    .min(1, 'every partner must have at least one milestone')
    .refine(
      arr => arr.filter(m => m.type === 'establishment').length === 1,
      'must contain exactly one establishment milestone'
    )
    .refine(
      arr => arr.every((m, i) => i === 0 || m.date >= arr[i - 1].date),
      'milestones must be in chronological order (oldest first)'
    ),
});

MilestoneSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: z.enum(['establishment', 'expansion', 'investment', 'product-launch', 'customer-win']),
  headline: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  url: z.string().url(),
});
```

Validation runs at build time via the existing `npm run validate-data` script.

### Invariants

- Every partnership (regardless of `status`) must have exactly one milestone with `type='establishment'`.
- Milestones array is ordered chronologically, oldest first.
- The first milestone is always the establishment; later milestones are expansions/investments/etc.

---

## Workflow and commands

Three slash commands plus the Sunday email reminder.

### `/seed-milestones` (new, one-time)

Lives at `.claude/commands/seed-milestones.md`. One-time interactive backfill for the existing 28 partners.

**Per-partner flow:**

1. Read existing `notes`, `evidence_url`, `evidence_quote`, `evidence_history`, and `first_announced`.
2. Run ~2 targeted web searches (`"$PARTNER NVIDIA partnership timeline"`, `"$PARTNER NVIDIA revenue exposure"` or similar).
3. Draft:
   - At minimum, an `establishment` milestone (date = `first_announced`, headline + description synthesized from `notes` and existing evidence URL).
   - Additional milestones for any major events identifiable from sourcing.
   - `significance_tier` and `significance_narrative` based on the partner's overall business profile.
4. **Auto-flag thin sourcing**: if Claude can't find adequate public sources for a partner's expansion history, downgrade the partner's `confidence` field one step (`high` → `medium`, or `medium` → `low`) and append a one-line note to `notes` noting limited public expansion sourcing.
5. Show the draft to the user with options: `keep` / `skip` / `edit` / `rerun`.
6. After approval, mutate `relationships.json`:
   - Add new fields (`significance_tier`, `significance_narrative`, `significance_reviewed_at` = today, `milestones`).
   - **Remove** old fields (`evidence_url`, `evidence_quote`, `evidence_history`, `first_announced`).

**Guardrails:**

- Errors out if `relationships.json` already has populated `milestones` for any partner — prevents clobbering future manual edits.
- Per-partner saves are atomic — interruptible, resumable.

**Commit message:** `Seed milestones: backfill structured timeline for N partners`.

### `/extract` (modified)

Existing slash command at `.claude/commands/extract.md`. Two behavior changes; everything else stays.

**Change 1: UPDATE classification splits in two.**

For each article classified as UPDATE for an existing partner, Claude makes a follow-up judgment:

- **Substantive milestone** — article names a new product, expansion, investment, customer win, or similar event. Action: append a Milestone to the partner's `milestones[]`. Bump `last_confirmed`.
- **Bare confirmation** — article merely re-mentions the partnership exists without new information. Action: bump `last_confirmed` only. Do not add a milestone.

**Change 2: PROPOSE NEW skeleton expanded.**

For new partnerships, the skeleton now includes:

- `milestones: [{ type: 'establishment', date, headline, description, url }]` derived from the article.
- `significance_tier` and `significance_narrative` drafted by Claude.
- `significance_reviewed_at` = today.
- Auto-flag thin sourcing: same mechanism as `/seed-milestones` — downgrade `confidence`, add a note.

**Commit message** unchanged: `Week of YYYY-MM-DD: N updates, M new partners`.

### `/review-significance` (new)

Lives at `.claude/commands/review-significance.md`. Run on demand (monthly/quarterly) to refresh tier and narrative based on accumulated milestones.

**Flow:**

1. Read `relationships.json`.
2. For each partner, gather milestones added since `significance_reviewed_at`.
3. **If none → skip silently.**
4. Otherwise, Claude re-reads the full milestones list and current narrative, drafts an updated `significance_tier` and `significance_narrative`. Tier changes require a strong articulable reason — default is preserve.
5. Walk user through *only changed* partners (those whose draft differs from current): `keep` / `skip` / `edit`.
6. After approval, bump `significance_reviewed_at` to today for the touched partner.

**Commit message:** `Significance review YYYY-MM-DD: N partners updated`.

### Sunday email reminder

`scripts/send-reminder.ts` updated to count both maintenance queues:

```
Sunday maintenance — NVIDIA Tracker

/extract:               23 new articles since last extraction (12 days ago)
/review-significance:    4 partners have new milestones since last review

When ready, run both in Claude Code.
```

If both queues are 0 → no email sent (current short-circuit behavior preserved).

---

## UI changes

### Hover card (`src/components/HoverCard.astro`)

Width: 240px → 260px.

```
┌──────────────────────────────┐
│  [TSMC logo]                 │
│  TSMC                        │  ← italic serif, 600 weight
│  silicon · core              │  ← meta line; "core" bolded
│                              │
│  Manufactures Nvidia leading-│
│  edge GPUs on N4 nodes…      │  ← purpose (unchanged)
│  ───────────────             │
│  LATEST MILESTONES           │  ← small italic muted label
│  2025-12-10  expansion       │  ← date muted, type italic muted
│  60% of CoWoS capacity…      │  ← headline, ink color
│  2025-10-15  expansion       │
│  Rubin moved to N3P process  │
└──────────────────────────────┘
```

**Tier styling in meta line:**

- `core` → ink color, **bold**
- `significant` → ink color, regular weight
- `ancillary` → muted color, regular weight

**Milestone selection:**

Show up to 2 most recent milestones. If fewer than 2 non-establishment milestones exist, fall back to including establishment.

**Removed:** the meta line drops `last_confirmed` (rarely useful at hover-glance) in favor of the tier.

**Mobile fallback:** `max-width: 90vw` on the hover card so it doesn't overflow narrow viewports.

### List page (`src/pages/list.astro`)

Column changes:

| Old columns | New columns |
|---|---|
| Partner | Partner |
| Category | Category |
| Purpose | Purpose |
| Last confirmed | **Significance** (tier badge) |
| Confidence | **Latest milestone** (date + truncated headline, max 60 chars) |

`Confidence` is removed from the table view (still visible on the detail page footer). `Last confirmed` is replaced — "Latest milestone" includes a date and is more interesting at a glance.

Significance column visual: italic serif text matching hover-card tier styling (core bold ink, significant regular ink, ancillary muted).

### Detail page (`src/pages/partners/[id].astro`)

Section ordering:

1. **Header** — logo, name, meta line: `category · tier · status`. Confidence removed from header.
2. **Significance narrative** — *new*. Italic serif paragraph immediately below header. 1–2 sentences from `significance_narrative`. Visually framed as "what this partnership means to the partner."
3. **Purpose** — unchanged.
4. **Notes** — unchanged (if present).
5. **Milestones timeline** — *replaces* the Evidence section. Renders the full milestones list chronologically (oldest → newest). Each entry:

   ```
   [type label]   2025-12-10
   60% of CoWoS capacity secured through 2026–27
   1–2 sentence description providing context.
   → digitimes.com (source link)
   ```

6. **Footer** — `Established 2020-01-01 · Last confirmed 2025-12-10 · high confidence`. Confidence reappears here as metadata.

### Components

- **New:** `src/components/MilestoneTimeline.astro` — renders a `Milestone[]` array on the detail page.
- **Removed:** `src/components/EvidenceTimeline.astro` — deleted entirely (no orphaned component for a removed field).

### Graph

No changes. Confirmed during clarifying questions — the graph stays clean; significance and milestones surface only in hover/list/detail.

---

## Migration plan

Single feature branch (recommended: in a git worktree to keep `main` clean). Atomic staged commits within the branch:

1. Add new schema (Zod + types) **alongside** old schema — additive only.
2. Update `lib/data.ts` and `lib/filters.ts` to accept either shape during transition.
3. Add `/seed-milestones` slash command at `.claude/commands/seed-milestones.md`.
4. Run `/seed-milestones` interactively to populate new fields and remove old fields from `relationships.json`.
5. Verify `npm run build` and `npm test` still pass.
6. Strip old fields from Zod schema — schema becomes strict on new shape.
7. Update `HoverCard.astro`, `list.astro`, `partners/[id].astro` to read new fields.
8. Add `MilestoneTimeline.astro`; delete `EvidenceTimeline.astro`.
9. Update `/extract` slash command (`.claude/commands/extract.md`) with new substantive-vs-confirmation logic and new partnership skeleton.
10. Add `/review-significance` slash command at `.claude/commands/review-significance.md`.
11. Update `scripts/send-reminder.ts` to count both queues.
12. Update tests; run `npm test` to confirm 35+ passing.
13. `npm run build` and `npm run deploy`.

---

## Test plan

Current: 35 tests passing.

**Tests that change (~15):** anything touching `evidence_url`, `evidence_history`, or `first_announced` — filter tests, schema tests, data-loading tests, snapshot tests of the Relationship shape.

**Tests added (~8):**

- Milestone schema validation: chronological order, establishment uniqueness, length caps.
- Significance enum validation.
- "Latest milestone" extraction helper for the list page (handles partners with only an establishment milestone).
- "Recent milestones for hover card" helper (handles fallback to establishment when fewer than 2 non-establishment milestones).

**Target:** 35+ passing post-migration. Acceptance: `npm test` clean, `npm run build` clean, `npm run validate-data` clean.

---

## Risks and open questions

1. **Sourcing quality varies by partner** — public partners (TSMC, Marvell) have abundant 10-K disclosure; smaller/private partners have only a press-release trail. **Mitigation:** Claude auto-downgrades `confidence` and adds a `notes` line when sourcing is thin during `/seed-milestones` and `/extract`. No fabricated milestones — schema requires every milestone to have a real `url`.

2. **Significance tier flip-flopping** — `/review-significance` could oscillate a tier (core → significant → core) as new milestones land. **Mitigation:** the command's prompt instructs that tier changes require a strong articulable reason; default is preserve.

3. **Web search reliability inside slash commands** — Claude's web searches sometimes return junk results. **Mitigation:** prefer established financial sources (10-Ks, earnings calls, IR pages) where partner is public; fall back to existing `notes` and `evidence_url` if search results are weak.

4. **Hover card width on narrow viewports** — 260px may overflow on small phones. **Mitigation:** `max-width: 90vw` fallback. Mobile optimization deferred.

5. **Branch lifetime** — multi-day branch given the interactive `/seed-milestones` step. **Mitigation:** use a git worktree so `main` stays usable for unrelated edits.

---

## Acceptance criteria

- [ ] All 28 existing partners have valid milestones, significance_tier, significance_narrative, and significance_reviewed_at populated.
- [ ] Build succeeds with strict new Zod schema (no old fields tolerated).
- [ ] `npm test` ≥ 35 passing.
- [ ] Hover card on the live site shows tier + 2 latest milestones in Option-B layout.
- [ ] List page shows Significance and Latest milestone columns.
- [ ] Detail page shows full milestone timeline + significance narrative paragraph.
- [ ] `/extract` correctly distinguishes substantive vs bare-confirmation articles.
- [ ] `/review-significance` runs cleanly with zero changed partners on a fresh post-seed dataset.
- [ ] Sunday email shows both `/extract` and `/review-significance` queues.
- [ ] Site deployed to `nvidia-tracker.seanfkelley1.workers.dev`.
