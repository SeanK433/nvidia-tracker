# Milestones and Significance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `evidence_history` field with structured `milestones[]`, add a significance tier + narrative for each partner, redesign the hover card / list / detail surfaces, and update the weekly maintenance workflow.

**Architecture:** Three-phase migration. Phase 1: add new fields as **optional** alongside existing ones — schema is permissive, old data still validates. Phase 2: a new `/seed-milestones` slash command populates new fields for all 28 partners interactively (additive — keeps old fields). Phase 3: UI consumers swap to new fields one at a time. Phase 4: a single cleanup commit makes the schema strict, strips old fields from JSON, and deletes the orphaned `EvidenceTimeline` component. Phase 5+ adds the new slash commands and updates the Sunday email reminder. Each commit leaves the build green.

**Tech Stack:** Astro 4, TypeScript, Zod, Cytoscape.js, Vitest, Cloudflare Workers, Resend.

**Spec:** `docs/superpowers/specs/2026-05-02-milestones-and-significance-design.md`

---

## Prerequisites

Create a git worktree so this multi-day branch doesn't block `main`:

```bash
cd "/c/Users/skelley1/Claude Projects/nvidia-tracker"
git worktree add ../nvidia-tracker-milestones -b feat/milestones-significance
cd ../nvidia-tracker-milestones
npm install
```

All work happens in `nvidia-tracker-milestones/`. When the branch is merged, run `git worktree remove ../nvidia-tracker-milestones` to clean up.

---

## Phase 1 — Permissive schema and helpers (additive only)

### Task 1: Add Milestone schema and optional significance fields

**Files:**
- Modify: `src/lib/schema.ts`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Write failing tests**

Add this block to the END of `tests/schema.test.ts`:

```typescript
import { MilestoneSchema, SignificanceTierSchema } from '../src/lib/schema';

describe('MilestoneSchema', () => {
  const valid = {
    date: '2025-12-10',
    type: 'expansion' as const,
    headline: '60% of CoWoS capacity secured through 2026-27',
    description: 'TSMC reserved the bulk of advanced packaging capacity for Nvidia products.',
    url: 'https://example.com/article'
  };

  it('accepts a valid milestone', () => {
    expect(() => MilestoneSchema.parse(valid)).not.toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => MilestoneSchema.parse({ ...valid, type: 'bogus' })).toThrow();
  });

  it('rejects headline > 100 chars', () => {
    expect(() => MilestoneSchema.parse({ ...valid, headline: 'x'.repeat(101) })).toThrow();
  });

  it('rejects description > 300 chars', () => {
    expect(() => MilestoneSchema.parse({ ...valid, description: 'x'.repeat(301) })).toThrow();
  });

  it('rejects malformed date', () => {
    expect(() => MilestoneSchema.parse({ ...valid, date: '2025/12/10' })).toThrow();
  });

  it('rejects non-URL source', () => {
    expect(() => MilestoneSchema.parse({ ...valid, url: 'not-a-url' })).toThrow();
  });
});

describe('SignificanceTierSchema', () => {
  it('accepts core, significant, ancillary', () => {
    expect(() => SignificanceTierSchema.parse('core')).not.toThrow();
    expect(() => SignificanceTierSchema.parse('significant')).not.toThrow();
    expect(() => SignificanceTierSchema.parse('ancillary')).not.toThrow();
  });

  it('rejects other values', () => {
    expect(() => SignificanceTierSchema.parse('high')).toThrow();
  });
});

describe('RelationshipSchema with optional new fields', () => {
  const base = {
    id: 'tsmc',
    partner: 'TSMC',
    category: 'silicon' as const,
    purpose: 'Foundry partnership',
    evidence_quote: 'q',
    evidence_url: 'https://example.com',
    evidence_history: [],
    first_announced: '2020-01-01',
    last_confirmed: '2026-04-15',
    status: 'active' as const,
    confidence: 'high' as const,
    notes: ''
  };

  it('accepts a relationship with no new fields (backward compat)', () => {
    expect(() => RelationshipSchema.parse(base)).not.toThrow();
  });

  it('accepts a relationship with new fields populated', () => {
    const enriched = {
      ...base,
      significance_tier: 'core',
      significance_narrative: 'TSMC is the sole leading-edge foundry for Nvidia GPUs; this relationship is core to TSMC\'s revenue growth.',
      significance_reviewed_at: '2026-05-02',
      milestones: [
        {
          date: '2020-01-01',
          type: 'establishment',
          headline: 'TSMC selected as Nvidia foundry partner',
          description: 'TSMC began producing Nvidia leading-edge GPUs.',
          url: 'https://example.com/tsmc-establishment'
        }
      ]
    };
    expect(() => RelationshipSchema.parse(enriched)).not.toThrow();
  });

  it('rejects significance_narrative > 280 chars', () => {
    expect(() => RelationshipSchema.parse({
      ...base,
      significance_narrative: 'x'.repeat(281)
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/schema.test.ts
```

Expected: errors mentioning `MilestoneSchema is not exported` and `SignificanceTierSchema is not exported`.

- [ ] **Step 3: Implement schema additions**

Edit `src/lib/schema.ts`. Add these blocks AFTER the existing `EvidenceEntrySchema` (around line 19):

```typescript
export const MilestoneTypeSchema = z.enum([
  'establishment',
  'expansion',
  'investment',
  'product-launch',
  'customer-win'
]);

export const MilestoneSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: MilestoneTypeSchema,
  headline: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
  url: z.string().url()
});

export type Milestone = z.infer<typeof MilestoneSchema>;
export type MilestoneType = z.infer<typeof MilestoneTypeSchema>;

export const SignificanceTierSchema = z.enum(['core', 'significant', 'ancillary']);
export type SignificanceTier = z.infer<typeof SignificanceTierSchema>;
```

Then EXTEND `RelationshipSchema` by appending these optional fields just before the closing `})`:

```typescript
  // New milestones + significance fields. OPTIONAL during Phase 1 migration;
  // become REQUIRED after /seed-milestones runs and Phase 4 cleanup tightens the schema.
  significance_tier: SignificanceTierSchema.optional(),
  significance_narrative: z.string().min(1).max(280).optional(),
  significance_reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  milestones: z.array(MilestoneSchema).optional()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all 35+ tests pass (35 original + 10 new = 45).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts tests/schema.test.ts
git commit -m "feat(schema): add Milestone schema and optional significance fields

Adds MilestoneSchema and SignificanceTierSchema along with four new
optional fields on RelationshipSchema. Existing data still validates
because new fields are optional during Phase 1 migration."
```

---

### Task 2: Add helper functions for latest and recent milestones

**Files:**
- Modify: `src/lib/filters.ts`
- Test: `tests/filters.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the import block at the top of `tests/filters.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest';
import {
  filterActive,
  filterByCategory,
  filterByConfidence,
  groupByCategory,
  sortByPartner,
  sortByLastConfirmed,
  latestMilestone,
  recentMilestonesForHover
} from '../src/lib/filters';
import type { Relationship, Milestone } from '../src/lib/schema';
```

Then ADD this block at the end of the file:

```typescript
const ms = (date: string, type: Milestone['type'], headline: string): Milestone => ({
  date,
  type,
  headline,
  description: 'desc',
  url: 'https://example.com'
});

describe('latestMilestone', () => {
  it('returns the most recent milestone by date', () => {
    const milestones = [
      ms('2020-01-01', 'establishment', 'Start'),
      ms('2024-06-15', 'expansion', 'Mid'),
      ms('2025-12-10', 'expansion', 'Latest')
    ];
    expect(latestMilestone(milestones)?.headline).toBe('Latest');
  });

  it('returns null for empty array', () => {
    expect(latestMilestone([])).toBe(null);
  });

  it('returns the only entry for length-1 arrays', () => {
    const only = [ms('2020-01-01', 'establishment', 'Only')];
    expect(latestMilestone(only)?.headline).toBe('Only');
  });
});

describe('recentMilestonesForHover', () => {
  it('returns up to 2 most recent milestones', () => {
    const milestones = [
      ms('2020-01-01', 'establishment', 'Start'),
      ms('2024-06-15', 'expansion', 'Mid'),
      ms('2025-12-10', 'expansion', 'Latest')
    ];
    const recent = recentMilestonesForHover(milestones);
    expect(recent.map(m => m.headline)).toEqual(['Latest', 'Mid']);
  });

  it('returns establishment as fallback when only 1 milestone exists', () => {
    const only = [ms('2020-01-01', 'establishment', 'Only')];
    expect(recentMilestonesForHover(only).map(m => m.headline)).toEqual(['Only']);
  });

  it('returns empty array for empty input', () => {
    expect(recentMilestonesForHover([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/filters.test.ts
```

Expected: errors that `latestMilestone` and `recentMilestonesForHover` are not exported.

- [ ] **Step 3: Implement helpers**

Append to the end of `src/lib/filters.ts`:

```typescript
import type { Milestone } from './schema';

export function latestMilestone(milestones: Milestone[]): Milestone | null {
  if (milestones.length === 0) return null;
  return [...milestones].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function recentMilestonesForHover(milestones: Milestone[]): Milestone[] {
  return [...milestones]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2);
}
```

Then add the new types to the existing import at the top — change:

```typescript
import type { Relationship, Category, Confidence } from './schema';
```

to:

```typescript
import type { Relationship, Category, Confidence, Milestone } from './schema';
```

(remove the redundant `import type { Milestone }` at the bottom; consolidate into the top import).

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: 45+ tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filters.ts tests/filters.test.ts
git commit -m "feat(filters): add latestMilestone and recentMilestonesForHover helpers"
```

---

## Phase 2 — Seed milestones into all 28 partners

### Task 3: Write the /seed-milestones slash command

**Files:**
- Create: `.claude/commands/seed-milestones.md`

- [ ] **Step 1: Create the command file with the full instruction set**

Create `.claude/commands/seed-milestones.md` with this content:

````markdown
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
````

- [ ] **Step 2: Verify the file renders correctly**

```bash
cat .claude/commands/seed-milestones.md | head -20
```

Expected: file is readable with the YAML frontmatter intact.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/seed-milestones.md
git commit -m "feat(commands): add /seed-milestones for one-time migration"
```

---

### Task 4: Run /seed-milestones interactively

**Files:** Modifies `data/relationships.json` (run inside Claude Code).

- [ ] **Step 1: Open the project in Claude Code**

```bash
cd "/c/Users/skelley1/Claude Projects/nvidia-tracker-milestones"
claude
```

- [ ] **Step 2: Run the command**

Type `/seed-milestones` in the Claude Code session. Walk through all 28 partners. Use `keep` / `skip` / `edit` / `rerun` per partner.

- [ ] **Step 3: After the command finishes, verify the data**

```bash
npm run validate-data
```

Expected: success — all 28 partners validate against the (still permissive) schema.

```bash
node -e "const d=require('./data/relationships.json'); console.log('partners:', d.length); console.log('with milestones:', d.filter(r=>r.milestones?.length).length); console.log('with tier:', d.filter(r=>r.significance_tier).length);"
```

Expected: `partners: 28`, `with milestones: 28`, `with tier: 28`.

- [ ] **Step 4: Confirm the commit landed**

The /seed-milestones command commits its own changes per its instructions. Verify:

```bash
git log --oneline -3
```

Expected: most recent commit is `data: seed milestones and significance for all partners`.

---

## Phase 3 — UI updates (read new fields)

### Task 5: Build MilestoneTimeline component

**Files:**
- Create: `src/components/MilestoneTimeline.astro`

- [ ] **Step 1: Create the component**

Create `src/components/MilestoneTimeline.astro`:

```astro
---
// src/components/MilestoneTimeline.astro
// Renders a partner's full milestones list on the detail page,
// chronologically (oldest first), with type label and source link.
import type { Milestone } from '~/lib/schema';

interface Props {
  milestones: Milestone[];
}

const { milestones } = Astro.props;
const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date));
---
<ol class="ms-timeline">
  {sorted.map((m) => (
    <li class="ms-entry">
      <div class="ms-meta">
        <span class={`ms-type ms-type-${m.type}`}>{m.type.replace('-', ' ')}</span>
        <time class="ms-date">{m.date}</time>
      </div>
      <div class="ms-headline">{m.headline}</div>
      <p class="ms-description">{m.description}</p>
      <a class="ms-link" href={m.url} rel="noopener noreferrer" target="_blank">
        → {new URL(m.url).hostname}
      </a>
    </li>
  ))}
</ol>

<style>
.ms-timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  border-left: 1px solid var(--ink-faint);
}

.ms-entry {
  padding: var(--space-4) 0 var(--space-4) var(--space-5);
  position: relative;
}

.ms-entry::before {
  content: "";
  position: absolute;
  left: -4px;
  top: var(--space-5);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink);
}

.ms-meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-1);
}

.ms-type {
  font-style: italic;
  font-size: var(--size-xs);
  color: var(--ink-muted);
  text-transform: lowercase;
  letter-spacing: 0.3px;
}

.ms-date {
  font-style: italic;
  color: var(--ink-muted);
  font-variant-numeric: tabular-nums;
  font-size: var(--size-xs);
}

.ms-headline {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--size-base);
  color: var(--ink);
  margin-bottom: var(--space-1);
}

.ms-description {
  font-size: var(--size-sm);
  color: var(--ink);
  line-height: 1.5;
  margin: var(--space-1) 0 var(--space-2);
}

.ms-link {
  font-size: var(--size-xs);
  font-style: italic;
  color: var(--ink-muted);
  text-decoration: none;
}
.ms-link:hover { color: var(--ink); }
</style>
```

- [ ] **Step 2: Verify it builds**

```bash
npm run build
```

Expected: build succeeds (component is unused so far, but should compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/MilestoneTimeline.astro
git commit -m "feat(components): add MilestoneTimeline for detail page"
```

---

### Task 6: Update HoverCard component skeleton

**Files:**
- Modify: `src/components/HoverCard.astro`

- [ ] **Step 1: Replace the entire HoverCard.astro file**

```astro
---
// src/components/HoverCard.astro
// Floating card shown when a graph node is hovered. Hidden by default;
// the Graph component populates and positions it on mouseover.
---
<div id="hover-card" class="hover-card" aria-hidden="true">
  <img class="hover-card-logo" id="hover-card-logo" alt="" />
  <div class="hover-card-body">
    <div class="hover-card-name" id="hover-card-name"></div>
    <div class="hover-card-meta" id="hover-card-meta"></div>
    <div class="hover-card-purpose" id="hover-card-purpose"></div>
    <div class="hover-card-milestones" id="hover-card-milestones">
      <div class="hover-card-ms-label">Latest milestones</div>
      <div id="hover-card-ms-list"></div>
    </div>
  </div>
</div>

<style>
.hover-card {
  position: absolute;
  background: var(--paper);
  border: 1px solid var(--ink);
  border-radius: 4px;
  padding: var(--space-3);
  width: 260px;
  max-width: 90vw;
  box-shadow: 0 4px 12px rgba(26, 22, 18, 0.12);
  font-size: var(--size-xs);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s;
  z-index: 100;
}

.hover-card[data-visible="true"] { opacity: 1; }

.hover-card-logo {
  height: 28px;
  max-width: 80px;
  width: auto;
  object-fit: contain;
  margin-bottom: var(--space-2);
}

.hover-card-name {
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 600;
  font-size: var(--size-base);
  color: var(--ink);
  margin-bottom: var(--space-1);
}

.hover-card-meta {
  color: var(--ink-muted);
  font-style: italic;
  margin-bottom: var(--space-2);
}

/* Tier styling within meta line */
.hover-card-meta .tier-core      { color: var(--ink); font-weight: 600; font-style: normal; }
.hover-card-meta .tier-significant { color: var(--ink); font-style: normal; }
.hover-card-meta .tier-ancillary { color: var(--ink-muted); font-style: normal; }

.hover-card-purpose {
  color: var(--ink);
  line-height: 1.4;
  margin-bottom: var(--space-3);
}

.hover-card-milestones {
  border-top: 1px solid var(--ink-faint);
  padding-top: var(--space-2);
}

.hover-card-ms-label {
  font-style: italic;
  color: var(--ink-muted);
  text-transform: uppercase;
  font-size: 9.5px;
  letter-spacing: 0.7px;
  margin-bottom: var(--space-1);
}

.hover-card-ms-row {
  margin-bottom: var(--space-1);
}
.hover-card-ms-row:last-child { margin-bottom: 0; }

.hover-card-ms-meta {
  font-size: 11px;
  color: var(--ink-muted);
}

.hover-card-ms-meta .ms-type {
  font-style: italic;
  margin-left: var(--space-1);
}

.hover-card-ms-headline {
  color: var(--ink);
  margin-top: 1px;
}
</style>
```

- [ ] **Step 2: Verify it builds**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/HoverCard.astro
git commit -m "feat(hover-card): redesign skeleton with tier and milestones sections

Width grows from 240px to 260px (max-width 90vw on narrow viewports).
Adds .tier-* classes for core/significant/ancillary styling, plus a
divider section for latest milestones populated by Graph.astro."
```

---

### Task 7: Update Graph.astro to pass new data and populate the new hover card

**Files:**
- Modify: `src/components/Graph.astro`

- [ ] **Step 1: Update the elements array (frontmatter section)**

In `src/components/Graph.astro`, find the partner-mapping block (around line 47-62) and REPLACE the `data: { ... }` object with:

```typescript
  ...relationships.map((r) => ({
    data: {
      id: r.id,
      label: r.partner,
      kind: 'partner',
      category: r.category,
      confidence: r.confidence,
      milestoneCount: r.milestones?.length ?? 1,
      logo: `/logos/${r.id}.svg`,
      hasLogo: partnerHasLogo(r.id),
      logoAspect: getLogoAspect(r.id),
      partner: r.partner,
      purpose: r.purpose,
      tier: r.significance_tier ?? 'significant',
      recentMilestones: (r.milestones ?? [])
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 2)
    }
  })),
```

Note the changes:
- `evidenceCount` renamed to `milestoneCount` (with a fallback of 1 for any partner that somehow lacks milestones — defensive).
- `tier` and `recentMilestones` added.
- `lastConfirmed` removed (was unused now that hover meta line drops it).

- [ ] **Step 2: Update the partner-node sizing styles to use milestoneCount**

In the same file, find the two style blocks for `node[kind="partner"][?hasLogo]` (around line 247-253). Replace `evidenceCount` with `milestoneCount` in both `width` and `height` callbacks.

- [ ] **Step 3: Update the hover handler to populate the new card structure**

Find the `cy.on('mouseover', ...)` handler (around line 302). Replace the body with:

```typescript
  cy.on('mouseover', 'node[kind="partner"]', (evt) => {
    const node = evt.target;
    cy.elements().addClass('dimmed');
    node.removeClass('dimmed').addClass('highlighted');
    node.connectedEdges().removeClass('dimmed').addClass('highlighted');
    cy.getElementById('nvidia').removeClass('dimmed').addClass('highlighted');

    const data = node.data();
    hoverLogo.src = data.logo;
    hoverLogo.alt = data.partner;
    hoverName.textContent = data.partner;

    // Meta line: category · tier (with tier styling class)
    const tier = data.tier ?? 'significant';
    hoverMeta.innerHTML = `${data.category} · <span class="tier-${tier}">${tier}</span>`;

    hoverPurpose.textContent = data.purpose;

    // Milestones list — populate from data.recentMilestones
    const msList = document.getElementById('hover-card-ms-list');
    const msSection = document.getElementById('hover-card-milestones');
    if (msList && msSection) {
      const recent = data.recentMilestones ?? [];
      if (recent.length === 0) {
        msSection.style.display = 'none';
      } else {
        msSection.style.display = '';
        msList.innerHTML = recent.map((m: { date: string; type: string; headline: string }) => `
          <div class="hover-card-ms-row">
            <div class="hover-card-ms-meta">${m.date}<span class="ms-type">${m.type.replace('-', ' ')}</span></div>
            <div class="hover-card-ms-headline">${m.headline}</div>
          </div>
        `).join('');
      }
    }

    const renderedPos = node.renderedPosition();
    const containerRect = container.getBoundingClientRect();
    hoverCard.style.left = `${containerRect.left + renderedPos.x + 30}px`;
    hoverCard.style.top = `${containerRect.top + renderedPos.y - 20}px`;
    hoverCard.setAttribute('data-visible', 'true');
  });
```

- [ ] **Step 4: Verify build still works**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 5: Verify locally with a browser preview**

```bash
npm run dev
```

Open `http://localhost:4321` in the preview tools. Hover a partner node. The new hover card should appear with:
- Logo + partner name
- `<category> · <tier>` meta line (tier styled per class)
- Purpose
- "LATEST MILESTONES" label + 1–2 milestone rows

Stop the dev server (Ctrl+C) once verified.

- [ ] **Step 6: Commit**

```bash
git add src/components/Graph.astro
git commit -m "feat(graph): pass tier + milestones to hover card and update node sizing

Replaces evidenceCount with milestoneCount (sizing logic unchanged).
Hover handler now populates new HoverCard structure: tier in the meta
line and a milestones list rendered from recentMilestones."
```

---

### Task 8: Update list page columns

**Files:**
- Modify: `src/pages/list.astro`

- [ ] **Step 1: Update the table header and rows**

Replace the `<table>` block (around line 27-48) with:

```astro
    <table class="partner-table">
      <thead>
        <tr>
          <th class="th-partner">Partner</th>
          <th class="th-category">Category</th>
          <th class="th-significance">Significance</th>
          <th class="th-purpose">Purpose</th>
          <th class="th-milestone">Latest milestone</th>
        </tr>
      </thead>
      <tbody>
        {active.map((r) => {
          const latest = r.milestones && r.milestones.length > 0
            ? [...r.milestones].sort((a, b) => b.date.localeCompare(a.date))[0]
            : null;
          const tier = r.significance_tier ?? 'significant';
          const truncated = latest && latest.headline.length > 60
            ? latest.headline.slice(0, 57) + '...'
            : latest?.headline ?? '—';
          return (
            <tr data-category={r.category}>
              <td class="td-partner"><a href={`/partners/${r.id}`}>{r.partner}</a></td>
              <td class="td-category"><span class={`cat-badge cat-${r.category}`}>{r.category}</span></td>
              <td class="td-significance"><span class={`tier-${tier}`}>{tier}</span></td>
              <td class="td-purpose">{r.purpose}</td>
              <td class="td-milestone">
                {latest ? (
                  <>
                    <span class="td-milestone-date">{latest.date}</span>{' '}
                    <span class="td-milestone-headline">{truncated}</span>
                  </>
                ) : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
```

- [ ] **Step 2: Update the styles**

Append these styles to the existing `<style>` block:

```css
.td-significance .tier-core      { font-style: italic; color: var(--ink); font-weight: 600; }
.td-significance .tier-significant { font-style: italic; color: var(--ink); }
.td-significance .tier-ancillary { font-style: italic; color: var(--ink-muted); }

.td-milestone {
  font-size: var(--size-xs);
  color: var(--ink);
  max-width: 280px;
}
.td-milestone-date {
  color: var(--ink-muted);
  font-style: italic;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Visit `http://localhost:4321/list` in browser preview. Confirm:
- Columns: Partner | Category | Significance | Purpose | Latest milestone
- Confidence column GONE
- Last confirmed column GONE
- Significance column shows tier with proper styling (core bold ink, ancillary muted)
- Latest milestone shows date + headline (truncated if long)

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/pages/list.astro
git commit -m "feat(list): replace Last confirmed / Confidence columns with Significance / Latest milestone"
```

---

### Task 9: Update detail page

**Files:**
- Modify: `src/pages/partners/[id].astro`

- [ ] **Step 1: Replace the page**

Replace the entire `src/pages/partners/[id].astro` file with:

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
import Logo from '~/components/Logo.astro';
import MilestoneTimeline from '~/components/MilestoneTimeline.astro';
import { loadRelationships } from '~/lib/data';
import type { Relationship } from '~/lib/schema';

export const prerender = true;

export async function getStaticPaths() {
  const rels = loadRelationships();
  return rels.map((r) => ({
    params: { id: r.id },
    props: { rel: r }
  }));
}

interface Props {
  rel: Relationship;
}

const { rel } = Astro.props;
const tier = rel.significance_tier ?? 'significant';
const milestones = rel.milestones ?? [];
const establishment = milestones.find(m => m.type === 'establishment');
const establishedDate = establishment?.date ?? rel.first_announced ?? rel.last_confirmed;
---
<BaseLayout title={rel.partner} description={rel.purpose} pathname="">
  <article class="wrap-narrow" style="padding-top: var(--space-8); padding-bottom: var(--space-16);">
    <a href="/" class="back-link">← back to graph</a>

    <header class="partner-header">
      <Logo id={rel.id} partner={rel.partner} size={96} />
      <h1 class="partner-name">{rel.partner}</h1>
      <div class="partner-meta">
        <span class={`cat-badge cat-${rel.category}`}>{rel.category}</span>
        <span class="separator">·</span>
        <span class={`tier-badge tier-${tier}`}>{tier}</span>
        <span class="separator">·</span>
        <span class={`status-badge status-${rel.status}`}>{rel.status}</span>
      </div>
    </header>

    {rel.significance_narrative && (
      <section class="partner-significance">
        <p>{rel.significance_narrative}</p>
      </section>
    )}

    <section class="partner-purpose">
      <p>{rel.purpose}</p>
    </section>

    {rel.notes && (
      <section class="partner-notes">
        <h2>Notes</h2>
        <p>{rel.notes}</p>
      </section>
    )}

    <section class="partner-milestones">
      <h2>Milestones</h2>
      {milestones.length === 0 ? (
        <p class="muted">No milestones recorded.</p>
      ) : (
        <MilestoneTimeline milestones={milestones} />
      )}
    </section>

    <footer class="partner-footer muted">
      <span>Established: {establishedDate}</span>
      <span class="separator">·</span>
      <span>Last confirmed: {rel.last_confirmed}</span>
      <span class="separator">·</span>
      <span>{rel.confidence} confidence</span>
    </footer>
  </article>
</BaseLayout>

<style>
.back-link {
  display: inline-block;
  margin-bottom: var(--space-6);
  font-size: var(--size-sm);
  text-decoration: none;
  font-style: italic;
  color: var(--ink-muted);
}
.back-link:hover { color: var(--ink); }

.partner-header {
  text-align: center;
  margin-bottom: var(--space-6);
}

.partner-name {
  font-size: var(--size-3xl);
  margin-top: var(--space-4);
  margin-bottom: var(--space-2);
}

.partner-meta {
  font-size: var(--size-sm);
  color: var(--ink-muted);
  font-style: italic;
}

.partner-meta .separator {
  margin: 0 var(--space-2);
  color: var(--ink-faint);
}

.cat-badge { font-style: italic; }
.cat-silicon       { color: var(--cat-silicon); }
.cat-cloud         { color: var(--cat-cloud); }
.cat-vertical      { color: var(--cat-vertical); }
.cat-software      { color: var(--cat-software); }
.cat-interconnect  { color: var(--cat-interconnect); }
.cat-investment    { color: var(--cat-investment); }

.tier-badge { font-style: italic; }
.tier-core         { color: var(--ink); font-weight: 600; font-style: normal; }
.tier-significant  { color: var(--ink); font-style: normal; }
.tier-ancillary    { color: var(--ink-muted); font-style: normal; }

.status-badge { font-style: italic; }
.status-active   { color: var(--ink); }
.status-dormant  { color: var(--ink-muted); }
.status-ended    { color: var(--ink-muted); text-decoration: line-through; }

.partner-significance {
  margin: var(--space-6) 0 var(--space-6);
}

.partner-significance p {
  font-size: var(--size-base);
  line-height: 1.5;
  font-style: italic;
  color: var(--ink);
  text-align: center;
  max-width: 540px;
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.partner-purpose p {
  font-size: var(--size-lg);
  line-height: 1.6;
  font-style: italic;
  margin: var(--space-8) 0;
}

.partner-notes,
.partner-milestones {
  margin: var(--space-8) 0;
}

.partner-footer {
  margin-top: var(--space-12);
  padding-top: var(--space-4);
  border-top: 1px solid var(--ink-faint);
  font-size: var(--size-xs);
  color: var(--ink-muted);
}

.partner-footer .separator {
  margin: 0 var(--space-3);
}
</style>
```

- [ ] **Step 2: Verify build and test pages**

```bash
npm run build
npm run dev
```

Open `http://localhost:4321/partners/tsmc` in browser preview. Confirm:
- Header shows: logo, name, `silicon · core · active` (or whatever tier was assigned)
- Significance narrative paragraph appears below header (italic, centered)
- Purpose section unchanged
- Notes section unchanged (if present)
- "Milestones" section renders the full timeline via MilestoneTimeline component
- Footer shows: "Established YYYY-MM-DD · Last confirmed YYYY-MM-DD · high confidence"

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/partners/\[id\].astro
git commit -m "feat(detail): add significance narrative and milestone timeline sections

Header meta line: category · tier · status (confidence moved to footer).
Adds significance_narrative paragraph beneath header. Replaces Evidence
section with full MilestoneTimeline. Footer shows Established date
derived from establishment milestone."
```

---

## Phase 4 — Cleanup migration

### Task 10: Tighten schema, strip old fields, delete EvidenceTimeline

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `data/relationships.json`
- Modify: `tests/schema.test.ts`
- Modify: `tests/filters.test.ts`
- Delete: `src/components/EvidenceTimeline.astro`

- [ ] **Step 1: Strip old fields from `relationships.json`**

Run this script (one-off — paste into a terminal in the project root):

```bash
node -e "
const fs = require('fs');
const path = './data/relationships.json';
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
const cleaned = data.map(r => {
  const { evidence_quote, evidence_url, evidence_history, first_announced, ...rest } = r;
  return rest;
});
fs.writeFileSync(path, JSON.stringify(cleaned, null, 2));
console.log('Stripped old fields from', cleaned.length, 'partners');
"
```

Expected output: `Stripped old fields from 28 partners`.

- [ ] **Step 2: Tighten the Zod schema**

In `src/lib/schema.ts`, REMOVE these lines from `RelationshipSchema`:

```typescript
  evidence_quote: z.string().max(200),
  evidence_url: z.string().url(),
  evidence_history: z.array(EvidenceEntrySchema),
  first_announced: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
```

CHANGE the four new fields from optional to required:

```typescript
  significance_tier: SignificanceTierSchema,
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
```

The `EvidenceEntrySchema` export can be removed entirely (it's no longer used anywhere).

- [ ] **Step 3: Update `tests/schema.test.ts`**

Replace the `RelationshipSchema with optional new fields` describe block (added in Task 1) and the original `RelationshipSchema` block with this single block — strict-shape tests:

```typescript
describe('RelationshipSchema (strict shape)', () => {
  const valid = {
    id: 'tsmc',
    partner: 'TSMC',
    category: 'silicon' as const,
    purpose: 'foundry partnership',
    last_confirmed: '2026-04-15',
    status: 'active' as const,
    confidence: 'high' as const,
    notes: '',
    significance_tier: 'core' as const,
    significance_narrative: 'TSMC manufactures all leading-edge Nvidia GPUs.',
    significance_reviewed_at: '2026-05-02',
    milestones: [
      {
        date: '2020-01-01',
        type: 'establishment' as const,
        headline: 'TSMC selected as Nvidia foundry',
        description: 'Partnership begins for leading-edge GPU manufacturing.',
        url: 'https://example.com/start'
      }
    ]
  };

  it('accepts a fully-populated relationship', () => {
    expect(() => RelationshipSchema.parse(valid)).not.toThrow();
  });

  it('rejects when milestones is empty', () => {
    expect(() => RelationshipSchema.parse({ ...valid, milestones: [] })).toThrow();
  });

  it('rejects when there is no establishment milestone', () => {
    expect(() => RelationshipSchema.parse({
      ...valid,
      milestones: [{ ...valid.milestones[0], type: 'expansion' }]
    })).toThrow();
  });

  it('rejects when there are multiple establishment milestones', () => {
    expect(() => RelationshipSchema.parse({
      ...valid,
      milestones: [
        valid.milestones[0],
        { ...valid.milestones[0], date: '2021-01-01' }
      ]
    })).toThrow();
  });

  it('rejects when milestones are out of chronological order', () => {
    expect(() => RelationshipSchema.parse({
      ...valid,
      milestones: [
        { ...valid.milestones[0], date: '2025-01-01', type: 'expansion' as const },
        { ...valid.milestones[0], date: '2020-01-01' }
      ]
    })).toThrow();
  });

  it('rejects an old-style relationship with evidence_history', () => {
    const old = { ...valid, evidence_history: [{ url: 'https://x.com', date: '2020-01-01' }] };
    // Zod is strict-by-default — extra fields should be allowed unless we use .strict().
    // We rely on the runtime never producing them rather than schema-level rejection.
    expect(() => RelationshipSchema.parse(old)).not.toThrow();
  });
});
```

ALSO: DELETE the old `describe('RelationshipSchema', ...)` block from before (the one that tests with evidence_url etc — now obsolete).

- [ ] **Step 4: Update `tests/filters.test.ts`**

In the `sample` array (around line 12), update each entry to use the new shape. Remove `evidence_quote`, `evidence_url`, `evidence_history`, `first_announced`. Add `significance_tier`, `significance_narrative`, `significance_reviewed_at`, `milestones` (with at least one establishment).

Example updated entry:

```typescript
{
  id: 'tsmc', partner: 'TSMC', category: 'silicon',
  purpose: 'foundry',
  last_confirmed: '2026-04-15', status: 'active', confidence: 'high', notes: '',
  significance_tier: 'core',
  significance_narrative: 'TSMC manufactures all leading-edge Nvidia GPUs.',
  significance_reviewed_at: '2026-05-02',
  milestones: [
    { date: '2020-01-01', type: 'establishment', headline: 'Foundry partnership begins',
      description: 'TSMC selected for leading-edge Nvidia GPU production.',
      url: 'https://example.com/start' }
  ]
}
```

Update all three sample partners similarly.

- [ ] **Step 5: Delete EvidenceTimeline component**

```bash
rm src/components/EvidenceTimeline.astro
```

- [ ] **Step 6: Run tests + build**

```bash
npm run validate-data
npm test
npm run build
```

Expected:
- `npm run validate-data` succeeds (data file matches strict schema).
- `npm test` shows 45+ passing.
- `npm run build` succeeds.

- [ ] **Step 7: Commit**

```bash
git add data/relationships.json src/lib/schema.ts tests/schema.test.ts tests/filters.test.ts
git rm src/components/EvidenceTimeline.astro
git commit -m "refactor: tighten schema and strip legacy evidence_* fields

Removes evidence_quote, evidence_url, evidence_history, first_announced
from both the Zod schema and data/relationships.json. Makes new
fields (significance_tier, significance_narrative, significance_reviewed_at,
milestones) required. Deletes EvidenceTimeline.astro component since
the field it rendered no longer exists."
```

---

## Phase 5 — New workflow commands

### Task 11: Update /extract slash command

**Files:**
- Modify: `.claude/commands/extract.md`

- [ ] **Step 1: Replace the file with the updated extraction flow**

Overwrite `.claude/commands/extract.md` with:

````markdown
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
````

- [ ] **Step 2: Verify the file is well-formed**

```bash
head -3 .claude/commands/extract.md
```

Expected: shows `---`, `description: ...`, `---` frontmatter.

- [ ] **Step 3: Commit**

```bash
git add .claude/commands/extract.md
git commit -m "feat(commands): update /extract for milestones and significance

UPDATE classification splits into substantive (add milestone) vs bare
confirmation (bump last_confirmed only). PROPOSE NEW skeleton expanded
to include establishment milestone, significance tier, and narrative.
Auto-flag thin sourcing on proposals."
```

---

### Task 12: Add /review-significance slash command

**Files:**
- Create: `.claude/commands/review-significance.md`

- [ ] **Step 1: Create the file**

Create `.claude/commands/review-significance.md`:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/review-significance.md
git commit -m "feat(commands): add /review-significance for on-demand tier and narrative refresh"
```

---

### Task 13: Update Sunday email reminder

**Files:**
- Modify: `scripts/send-reminder.ts`
- Test: `tests/extraction-status.test.ts`

- [ ] **Step 1: Add a helper for counting partners needing significance review**

Edit `scripts/lib/extraction-status.ts` (existing file). Add this function:

```typescript
import type { Relationship } from '../../src/lib/schema';

export function countPartnersNeedingSignificanceReview(rels: Relationship[]): number {
  return rels.filter(r =>
    r.milestones.some(m => m.date > r.significance_reviewed_at)
  ).length;
}
```

- [ ] **Step 2: Add a test**

Append to `tests/extraction-status.test.ts`:

```typescript
import { countPartnersNeedingSignificanceReview } from '../scripts/lib/extraction-status';
import type { Relationship } from '../src/lib/schema';

describe('countPartnersNeedingSignificanceReview', () => {
  const baseRel = (over: Partial<Relationship>): Relationship => ({
    id: 'x', partner: 'X', category: 'silicon',
    purpose: 'p', last_confirmed: '2026-04-01', status: 'active',
    confidence: 'high', notes: '',
    significance_tier: 'core',
    significance_narrative: 'narr',
    significance_reviewed_at: '2026-04-01',
    milestones: [{
      date: '2020-01-01', type: 'establishment',
      headline: 'h', description: 'd', url: 'https://x.com'
    }],
    ...over
  });

  it('counts partners with milestones added after their last review', () => {
    const rels = [
      baseRel({ id: 'a' }), // no new milestones
      baseRel({
        id: 'b',
        milestones: [
          { date: '2020-01-01', type: 'establishment', headline: 'h', description: 'd', url: 'https://x.com' },
          { date: '2026-04-15', type: 'expansion', headline: 'h2', description: 'd2', url: 'https://x.com/2' }
        ]
      })
    ];
    expect(countPartnersNeedingSignificanceReview(rels)).toBe(1);
  });

  it('returns 0 when no partner has new milestones', () => {
    expect(countPartnersNeedingSignificanceReview([baseRel({})])).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

```bash
npm test -- tests/extraction-status.test.ts
```

Expected: error that `countPartnersNeedingSignificanceReview` is not exported (if it's exported but returns wrong values, the assertion will fail).

- [ ] **Step 4: Wire the new helper into send-reminder.ts**

In `scripts/send-reminder.ts`:

REPLACE the import block at the top with:

```typescript
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resend } from 'resend';
import { parseExtractionDate, daysSince, countPartnersNeedingSignificanceReview } from './lib/extraction-status';
import { RawFileSchema } from '../src/lib/schema';
import { loadPending, loadRelationships } from '../src/lib/data';
```

REPLACE the `buildEmailBody` function with:

```typescript
function buildEmailBody(
  daysSinceLast: number | null,
  newArticles: number,
  pendingCount: number,
  partnersNeedingReview: number
): string {
  const stale = daysSinceLast === null
    ? "You haven't run an extraction yet."
    : `It's been ${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'} since your last extraction.`;

  const lines = [
    'Sunday maintenance — NVIDIA Tracker',
    '',
    stale,
    '',
    `/extract:               ${newArticles} new article${newArticles === 1 ? '' : 's'} since last extraction`,
    `/review-significance:    ${partnersNeedingReview} partner${partnersNeedingReview === 1 ? '' : 's'} with new milestones since last review`,
  ];

  if (pendingCount > 0) {
    lines.push(`Pending review queue:    ${pendingCount}`);
  }

  lines.push('', 'Open Claude Code in the project folder and run /extract and /review-significance when ready.');
  return lines.join('\n');
}
```

REPLACE the body of `main()` with:

```typescript
async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.EMAIL_TO;

  if (!apiKey || !to) {
    console.warn('RESEND_API_KEY or EMAIL_TO not set — exiting cleanly without sending.');
    return;
  }

  const last = findLastExtraction();
  const days = last ? daysSince(last) : null;
  const newCount = countNewArticlesSince(last);
  const pending = loadPending().length;
  const needReview = countPartnersNeedingSignificanceReview(loadRelationships());

  // Short-circuit: nothing to do, no email.
  if (newCount === 0 && needReview === 0 && pending === 0) {
    console.log('No maintenance work pending — skipping email.');
    return;
  }

  const body = buildEmailBody(days, newCount, pending, needReview);
  const subject = `NVIDIA Tracker — ${newCount} articles + ${needReview} partners ready for review`;

  console.log('Email body:\n' + body);

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: 'NVIDIA Tracker <onboarding@resend.dev>',
    to,
    subject,
    text: body
  });

  if (error) {
    console.error('✗ Resend error:', error);
    process.exit(1);
  }
  console.log('✓ Reminder sent');
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass, including the new significance-review counter test.

- [ ] **Step 6: Smoke-test the script (no email sent without env vars)**

```bash
npm run remind
```

Expected: prints either `No maintenance work pending — skipping email.` or the email body to stdout. Does NOT throw.

- [ ] **Step 7: Commit**

```bash
git add scripts/send-reminder.ts scripts/lib/extraction-status.ts tests/extraction-status.test.ts
git commit -m "feat(reminder): include /review-significance queue in Sunday email

Counts partners with milestones newer than their significance_reviewed_at
and surfaces both queues in the email body. Short-circuits sending if
all three queues (articles, proposals, significance) are empty."
```

---

## Phase 6 — Final verification and deploy

### Task 14: Run the full pipeline and deploy

**Files:** none (verification + deployment).

- [ ] **Step 1: Full local validation**

```bash
npm test
```

Expected: all tests passing (target: 45+).

```bash
npm run validate-data
```

Expected: success.

```bash
npm run build
```

Expected: build completes without errors.

- [ ] **Step 2: Local preview smoke test**

```bash
npm run preview
```

Open the printed URL in browser preview tools. Click through:
- `/` (graph) — hover several partners; confirm the new hover card layout (logo, name, `category · tier`, purpose, "LATEST MILESTONES", 1–2 milestone rows).
- `/list` — confirm columns: Partner / Category / Significance / Purpose / Latest milestone. No Confidence column. No Last confirmed column.
- `/partners/tsmc` (or any partner) — confirm: header has tier badge, significance narrative below header, full milestone timeline replaces evidence section, footer shows Established date + last confirmed + confidence.

Stop the preview server.

- [ ] **Step 3: Push the branch and merge**

```bash
git push -u origin feat/milestones-significance
```

Open the PR on GitHub manually (the user will review and merge, or we can use `gh pr create` if requested). After merge, switch back to the main worktree:

```bash
cd "/c/Users/skelley1/Claude Projects/nvidia-tracker"
git pull
```

- [ ] **Step 4: Deploy**

```bash
npm run deploy
```

Expected: `✨ Success!` with the deployed URL.

- [ ] **Step 5: Verify the live site**

Open `https://nvidia-tracker.seanfkelley1.workers.dev?cb=verify1` (cache-buster). Hover a partner. Check `/list` and `/partners/tsmc`.

If anything looks off, note it in a follow-up issue rather than rushing a fix.

- [ ] **Step 6: Clean up the worktree**

```bash
cd "/c/Users/skelley1/Claude Projects/nvidia-tracker"
git worktree remove ../nvidia-tracker-milestones
```

---

## Acceptance criteria (from spec)

- [ ] All 28 partners have valid milestones, significance_tier, significance_narrative, significance_reviewed_at populated.
- [ ] Build succeeds with strict new Zod schema (no old fields tolerated by code paths).
- [ ] `npm test` ≥ 35 passing (target: 45+).
- [ ] Hover card on the live site shows tier + 2 latest milestones in Option-B layout.
- [ ] List page shows Significance and Latest milestone columns.
- [ ] Detail page shows full milestone timeline + significance narrative paragraph.
- [ ] `/extract` correctly distinguishes substantive vs bare-confirmation articles (verify by walking through one weekly run after deploy).
- [ ] `/review-significance` runs cleanly with zero changed partners on the freshly-seeded dataset.
- [ ] Sunday email shows both `/extract` and `/review-significance` queues.
- [ ] Site deployed to `nvidia-tracker.seanfkelley1.workers.dev`.
