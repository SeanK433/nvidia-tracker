# Plan B — Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Many tasks in this plan are **parallel-safe** — see the "Parallelism Map" below before dispatching.

**Goal:** Build the graph-first editorial dashboard for the NVIDIA Tracker — a Cytoscape.js force-directed graph with transparent partner logos on cream paper, plus list view, detail pages, and methodology page. Replaces the current placeholder home.

**Architecture:** Astro pages render data from `data/relationships.json` at build time. The graph is a client-hydrated Cytoscape canvas; everything else is static HTML. Editorial design tokens (cream paper `#f3ede0`, ink `#1a1612`, Georgia serif, italic display) live in a single CSS file imported by all pages. Partner logos live as transparent SVGs in `public/logos/[id].svg`, with a serif italic text fallback when missing.

**Tech Stack:** Astro 4 + @astrojs/cloudflare, Cytoscape.js 3.x with cose-bilkent layout, vanilla CSS (no framework), TypeScript, Vitest.

---

## Parallelism Map

Concrete dispatch rounds, structured for maximum parallelism (per superpowers:subagent-driven-development "Sequential vs Parallel Dispatch"):

| Round | Tasks | Mode | Why |
|-------|-------|------|-----|
| **1** | 1, 2, 3, 4, 8 | **Parallel × 5** | Each creates entirely new files. No cross-imports. Task 1 = layout + theme. Task 2 = filters lib. Task 3 = Logo component. Task 4 = 28 logo SVGs. Task 8 = Graph.astro (initial). |
| **2** | 5, 6, 7 | **Parallel × 3** | Three independent page files. All depend on Round 1 (BaseLayout from Task 1; Logo from Task 3 for Task 7; filters from Task 2 for Task 6). |
| **3** | 9, 10, 11, 12 | **Sequential × 4** | All modify `Graph.astro`. Cannot parallelize without merge conflicts. |
| **4** | 13, 14 | **Sequential × 2** | Both touch `index.astro` and/or `BaseLayout.astro`. Task 13 must complete before Task 14's nav adjustments. |
| **5** | 15, 16, 17, 18 | **Sequential × 4** | Verification, README, smoke test, deploy. Each depends on prior. |

**Approximate speedup vs fully sequential:** ~35% (the Graph component is sequential anyway, and that's where the bulk of complexity lives).

**REQUIRED COMPANION SKILL when dispatching Round 1 or Round 2 in parallel:** Use superpowers:dispatching-parallel-agents.

**Conflict reconciliation:** If two parallel implementers report conflicting work (rare — would only happen if I miscategorized a task), pause, manually reconcile, and re-dispatch the affected ones sequentially.

---

## Prerequisites

- Plan A complete (collection pipeline, slash command, deploy infrastructure all working)
- `data/relationships.json` populated with ~28 seed partners
- Wrangler authenticated and able to deploy
- 28 tests passing locally

---

## Phase 1 — Foundation (sequential)

### Task 1: Editorial design tokens + base layout

**Files:**
- Create: `src/styles/theme.css`
- Create: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/index.astro` (temporarily — to use new layout, will be fully replaced in Task 13)

- [ ] **Step 1: Create `src/styles/theme.css`**

```css
/* src/styles/theme.css — editorial design tokens for NVIDIA Tracker */

:root {
  /* Colors */
  --paper:        #f3ede0;
  --paper-warm:   rgba(180, 160, 120, 0.08);
  --ink:          #1a1612;
  --ink-muted:    #6b5d45;
  --ink-faint:    rgba(26, 22, 18, 0.42);

  /* Category accent colors (use sparingly — for filter pills, hover highlights) */
  --cat-silicon:      #8b2c1f;
  --cat-cloud:        #2c3e60;
  --cat-vertical:     #a8721c;
  --cat-software:     #3a5c3a;
  --cat-interconnect: #8b2c1f;
  --cat-investment:   #3a5c3a;

  /* Typography */
  --font-serif: Georgia, 'Times New Roman', serif;
  --font-mono:  ui-monospace, 'SF Mono', Menlo, monospace;

  /* Sizes */
  --size-xs: 0.75rem;
  --size-sm: 0.875rem;
  --size-base: 1rem;
  --size-lg: 1.25rem;
  --size-xl: 1.5rem;
  --size-2xl: 2rem;
  --size-3xl: 2.5rem;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Layout */
  --content-max: 720px;
  --wide-max: 1100px;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: var(--size-base);
  line-height: 1.5;
}

body {
  background:
    radial-gradient(circle at 20% 30%, var(--paper-warm), transparent 45%),
    radial-gradient(circle at 80% 70%, var(--paper-warm), transparent 50%),
    var(--paper);
  min-height: 100vh;
}

a {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

a:hover {
  color: var(--cat-silicon);
}

h1, h2, h3 {
  font-weight: 400;
  font-style: italic;
  margin: 0 0 var(--space-4);
}

h1 { font-size: var(--size-3xl); }
h2 { font-size: var(--size-2xl); }
h3 { font-size: var(--size-xl); }

p { margin: 0 0 var(--space-4); }

.subtitle {
  color: var(--ink-muted);
  font-size: var(--size-sm);
  font-style: italic;
}

/* Site nav */
.site-nav {
  display: flex;
  gap: var(--space-6);
  justify-content: center;
  padding: var(--space-4);
  font-size: var(--size-sm);
  font-style: italic;
}

.site-nav a {
  text-decoration: none;
  color: var(--ink-muted);
}

.site-nav a:hover,
.site-nav a[aria-current="page"] {
  color: var(--ink);
  border-bottom: 1px solid var(--ink);
}

/* Utility classes */
.wrap-narrow { max-width: var(--content-max); margin: 0 auto; padding: var(--space-4); }
.wrap-wide   { max-width: var(--wide-max);    margin: 0 auto; padding: var(--space-4); }
.center      { text-align: center; }
.muted       { color: var(--ink-muted); }
```

- [ ] **Step 2: Create `src/layouts/BaseLayout.astro`**

```astro
---
// src/layouts/BaseLayout.astro
import '../styles/theme.css';

interface Props {
  title: string;
  description?: string;
  pathname?: string;  // current path for nav active state
}

const { title, description, pathname = '' } = Astro.props;
const fullTitle = title === 'NVIDIA Tracker' ? title : `${title} — NVIDIA Tracker`;

function activeClass(path: string): Record<string, string> {
  return pathname === path ? { 'aria-current': 'page' } : {};
}
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{fullTitle}</title>
    {description && <meta name="description" content={description} />}
  </head>
  <body>
    <nav class="site-nav">
      <a href="/" {...activeClass('/')}>graph</a>
      <a href="/list" {...activeClass('/list')}>list</a>
      <a href="/about" {...activeClass('/about')}>about</a>
    </nav>
    <slot />
  </body>
</html>
```

- [ ] **Step 3: Update `src/pages/index.astro` to use BaseLayout (placeholder behavior preserved)**

Replace contents with:

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
import { loadRelationships } from '~/lib/data';

const relationships = loadRelationships();
const activeCount = relationships.filter((r) => r.status === 'active').length;
---
<BaseLayout title="NVIDIA Tracker" pathname="/">
  <div class="wrap-narrow center" style="padding-top: var(--space-12);">
    <h1>NVIDIA Ecosystem</h1>
    <p>{activeCount} active partnerships tracked.</p>
    <p class="muted">Graph view in progress. <a href="/list">View as list</a>.</p>
  </div>
</BaseLayout>
```

- [ ] **Step 4: Verify build still succeeds**

```bash
npm run build
```

Expected: build complete, no errors. Visit `npm run dev` and confirm nav appears at top, page content unchanged structurally.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 28 passing.

- [ ] **Step 6: Commit**

```bash
git add src/styles/theme.css src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "feat: add editorial theme tokens and base layout"
```

---

### Task 2: Filter and grouping helpers (TDD)

**Files:**
- Create: `src/lib/filters.ts`
- Create: `tests/filters.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/filters.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  filterActive,
  filterByCategory,
  filterByConfidence,
  groupByCategory,
  sortByPartner,
  sortByLastConfirmed
} from '../src/lib/filters';
import type { Relationship } from '../src/lib/schema';

const sample: Relationship[] = [
  {
    id: 'tsmc', partner: 'TSMC', category: 'silicon',
    purpose: 'foundry', evidence_quote: 'q', evidence_url: 'https://e.com',
    evidence_history: [], first_announced: '2020-01-01',
    last_confirmed: '2026-04-15', status: 'active', confidence: 'high', notes: ''
  },
  {
    id: 'nebius', partner: 'Nebius', category: 'cloud',
    purpose: 'gpu cloud', evidence_quote: 'q', evidence_url: 'https://e.com',
    evidence_history: [], first_announced: '2024-01-01',
    last_confirmed: '2026-03-10', status: 'active', confidence: 'medium', notes: ''
  },
  {
    id: 'old-corp', partner: 'OldCorp', category: 'silicon',
    purpose: 'historic', evidence_quote: 'q', evidence_url: 'https://e.com',
    evidence_history: [], first_announced: '2018-01-01',
    last_confirmed: '2024-01-01', status: 'dormant', confidence: 'low', notes: ''
  }
];

describe('filterActive', () => {
  it('keeps only active entries', () => {
    expect(filterActive(sample).map(r => r.id)).toEqual(['tsmc', 'nebius']);
  });
});

describe('filterByCategory', () => {
  it('keeps only the specified category', () => {
    expect(filterByCategory(sample, 'silicon').map(r => r.id)).toEqual(['tsmc', 'old-corp']);
  });

  it('returns all when category is null', () => {
    expect(filterByCategory(sample, null).length).toBe(3);
  });
});

describe('filterByConfidence', () => {
  it('keeps only the specified confidence', () => {
    expect(filterByConfidence(sample, 'high').map(r => r.id)).toEqual(['tsmc']);
  });
});

describe('groupByCategory', () => {
  it('groups relationships by category, returning a Record<Category, Relationship[]>', () => {
    const grouped = groupByCategory(sample);
    expect(grouped.silicon?.map(r => r.id)).toEqual(['tsmc', 'old-corp']);
    expect(grouped.cloud?.map(r => r.id)).toEqual(['nebius']);
  });
});

describe('sortByPartner', () => {
  it('sorts alphabetically by partner name (case-insensitive)', () => {
    expect(sortByPartner(sample).map(r => r.partner)).toEqual(['Nebius', 'OldCorp', 'TSMC']);
  });
});

describe('sortByLastConfirmed', () => {
  it('sorts by last_confirmed descending (most recent first)', () => {
    expect(sortByLastConfirmed(sample).map(r => r.id)).toEqual(['tsmc', 'nebius', 'old-corp']);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- tests/filters.test.ts
```

Expected: error "Cannot find module '../src/lib/filters'"

- [ ] **Step 3: Implement `src/lib/filters.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- tests/filters.test.ts
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filters.ts tests/filters.test.ts
git commit -m "feat: add filter/sort/group helpers for relationships"
```

---

### Task 3: Logo component with fallback

**Files:**
- Create: `src/components/Logo.astro`

- [ ] **Step 1: Create the component**

```astro
---
// src/components/Logo.astro
// Renders a transparent partner SVG logo from public/logos/[id].svg.
// Falls back to italic serif text in matching ink color when no logo file exists.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface Props {
  id: string;
  partner: string;
  size?: number;       // pixel height; defaults to 40
  className?: string;
}

const { id, partner, size = 40, className = '' } = Astro.props;

// Check at build time whether a logo file exists for this id.
// (This runs at build time only; safe for static output.)
const logoPath = resolve(process.cwd(), 'public', 'logos', `${id}.svg`);
const hasLogo = existsSync(logoPath);
---
{hasLogo ? (
  <img
    src={`/logos/${id}.svg`}
    alt={partner}
    class={`partner-logo ${className}`}
    style={`height: ${size}px; width: auto; max-width: ${size * 4}px; object-fit: contain;`}
    loading="lazy"
  />
) : (
  <span
    class={`partner-fallback ${className}`}
    style={`font-family: Georgia, serif; font-style: italic; font-size: ${Math.round(size * 0.5)}px; color: var(--ink);`}
  >
    {partner}
  </span>
)}

<style>
.partner-logo {
  display: inline-block;
  vertical-align: middle;
}

.partner-fallback {
  display: inline-block;
  vertical-align: middle;
}
</style>
```

- [ ] **Step 2: Verify build succeeds**

```bash
npm run build
```

Expected: build complete (no `public/logos/` directory yet, but Logo component handles missing files gracefully via `existsSync` check).

- [ ] **Step 3: Commit**

```bash
git add src/components/Logo.astro
git commit -m "feat: add Logo component with serif italic fallback"
```

---

## Phase 2 — Logo sourcing (parallel with Phase 3 + 4)

### Task 4: Source SVG logos for all 28 seeded partners

**Files:**
- Create: `public/logos/<id>.svg` for each seeded partner (28 files)

This task is purely asset sourcing. The implementer will:
1. Read `data/relationships.json` to get the list of `id`s and `partner` names
2. For each partner, find an authoritative SVG logo from Wikimedia Commons (preferred) or the partner's own brand assets page
3. Download the SVG
4. Verify it has transparent background (no opaque fill behind the logo); if it has a solid white/colored background, edit the SVG to remove the background `<rect>` element
5. Save to `public/logos/<id>.svg`
6. Note partners where no clean SVG could be sourced (the Logo component will fall back to text for these)

- [ ] **Step 1: List the partners that need logos**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('data/relationships.json')).map(r => r.id + ' | ' + r.partner).join('\n'))"
```

This prints a list of 28 lines like `tsmc | TSMC`. Use this list as the work checklist.

- [ ] **Step 2: For each partner, source the SVG**

For each `<id> | <partner>` row:

1. WebSearch: `<partner> logo SVG site:commons.wikimedia.org`
2. Find the Wikimedia Commons SVG file page (will end in `.svg`)
3. Download the actual SVG file (the "Original file" link on the Commons page)
4. Open in a text editor — if the root `<svg>` contains a `<rect>` with `width="100%"` and a non-transparent `fill`, remove that rect
5. Save as `public/logos/<id>.svg`

Notes:
- Wikimedia Commons logos are generally OK for editorial/non-commercial use under fair use or CC-BY licenses; verify each license is permissive
- Some partners may not have a Wikimedia SVG (e.g., HUMAIN is too new) — for these, skip and note in the report
- Don't fabricate logos. If you can't find an authoritative source, leave the file out and the Logo component will fall back to text

- [ ] **Step 3: Verify visual rendering of a few**

Run `npm run dev` and visit `http://localhost:4321/list` (will be created in Task 6 — for now, manually inspect a few SVGs in `public/logos/` by opening them in a browser).

Each should display the brand logo with no opaque background — the cream paper should show through any background area.

- [ ] **Step 4: Commit all logos**

```bash
git add public/logos/
git commit -m "feat: source transparent SVG logos for 28 seed partners"
```

Report at the end:
- How many of 28 partners got logos sourced (e.g., "24 of 28")
- Which partners were skipped (will use text fallback) and why

---

## Phase 3 — Static pages (parallel after Phase 1)

### Task 5: About page

**Files:**
- Create: `src/pages/about.astro`

- [ ] **Step 1: Create `src/pages/about.astro`**

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
import { loadRelationships } from '~/lib/data';

const relationships = loadRelationships();
const totalActive = relationships.filter((r) => r.status === 'active').length;
const lastUpdate = relationships
  .map((r) => r.last_confirmed)
  .sort()
  .at(-1) ?? '—';
---
<BaseLayout title="About" description="Methodology for the NVIDIA Tracker" pathname="/about">
  <article class="wrap-narrow" style="padding-top: var(--space-12); padding-bottom: var(--space-16);">
    <h1>About this tracker</h1>
    <p class="subtitle">A living dataset of NVIDIA's public partnership ecosystem. Currently {totalActive} active partnerships, last updated {lastUpdate}.</p>

    <h2>What this is</h2>
    <p>This is a personal, editorial tracker of named, public partnerships between NVIDIA and other entities — covering silicon supply, networking fabric, cloud deployment, software collaboration, vertical-industry integration, and strategic investment with operational substance.</p>

    <h2>What counts as a partnership</h2>
    <p>A partnership is a <em>named, public, ongoing relationship</em> involving shared technology development, supply, deployment, integration, or strategic alignment. It must be:</p>
    <ul>
      <li><strong>Named publicly</strong> by NVIDIA, the partner, or both</li>
      <li><strong>Ongoing or forward-looking</strong> — not a one-time transaction</li>
      <li><strong>Substantive</strong> — has a stated purpose beyond marketing</li>
    </ul>

    <h2>What does NOT count</h2>
    <ul>
      <li>Customers buying GPUs (procurement ≠ partnership)</li>
      <li>Resellers and distributors</li>
      <li>Developers using CUDA</li>
      <li>Conference sponsorships and event appearances</li>
      <li>Rumored or unconfirmed deals</li>
      <li>Pure investments without operational tie</li>
      <li>Competitors framed as partners by press</li>
    </ul>

    <h2>The six categories</h2>
    <p>Each entry has exactly one primary category:</p>
    <ul>
      <li><strong>silicon</strong> — fabrication, memory, packaging, assembly</li>
      <li><strong>interconnect</strong> — NVLink, fabric partners</li>
      <li><strong>cloud</strong> — named infrastructure deployment programs</li>
      <li><strong>software</strong> — frameworks, models, platforms with co-engineering</li>
      <li><strong>vertical</strong> — auto, robotics, healthcare, industrial, telecom, sovereign-AI</li>
      <li><strong>investment</strong> — equity stakes with operational substance</li>
    </ul>

    <h2>Confidence rubric</h2>
    <ul>
      <li><strong>high</strong> — confirmed by NVIDIA's official channel AND by the partner</li>
      <li><strong>medium</strong> — confirmed by one side only, or tier-1 trade press citing on-record sources</li>
      <li><strong>low</strong> — reported but not officially confirmed; included only if widely treated as fact</li>
    </ul>

    <h2>Data sources</h2>
    <p>Articles are collected daily from a curated list of public sources: NVIDIA's blog and newsroom, SemiAnalysis, IEEE Spectrum, AnandTech, and others. Partnerships are extracted weekly with human review.</p>

    <h2>Corrections</h2>
    <p>Spot something wrong? Email <a href="mailto:seanfkelley1@gmail.com">seanfkelley1@gmail.com</a>.</p>

    <p class="muted" style="margin-top: var(--space-12); font-size: var(--size-xs);">
      Source code: <a href="https://github.com/SeanK433/nvidia-tracker">github.com/SeanK433/nvidia-tracker</a>
    </p>
  </article>
</BaseLayout>
```

- [ ] **Step 2: Verify build**

```bash
npm run build && npm run dev
```

Visit `http://localhost:4321/about`. Should render with cream paper, italic h1, body text, navigation at top.

- [ ] **Step 3: Commit**

```bash
git add src/pages/about.astro
git commit -m "feat: add /about methodology page"
```

---

### Task 6: List view (table with filters)

**Files:**
- Create: `src/pages/list.astro`

- [ ] **Step 1: Create `src/pages/list.astro`**

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
import { loadRelationships } from '~/lib/data';
import { filterActive, sortByPartner } from '~/lib/filters';

const all = loadRelationships();
const active = sortByPartner(filterActive(all));
const totalCount = all.length;
const activeCount = active.length;

const categories = ['silicon', 'interconnect', 'cloud', 'software', 'vertical', 'investment'] as const;
---
<BaseLayout title="List" description="All NVIDIA partnerships in tabular form" pathname="/list">
  <div class="wrap-wide" style="padding-top: var(--space-8); padding-bottom: var(--space-12);">
    <h1 class="center">All partnerships</h1>
    <p class="subtitle center">{activeCount} active · {totalCount - activeCount} dormant or ended</p>

    <div class="filters" id="filters">
      <button class="filter-pill active" data-category="all">all</button>
      {categories.map((c) => (
        <button class="filter-pill" data-category={c}>{c}</button>
      ))}
    </div>

    <table class="partner-table">
      <thead>
        <tr>
          <th class="th-partner">Partner</th>
          <th class="th-category">Category</th>
          <th class="th-purpose">Purpose</th>
          <th class="th-confirmed">Last confirmed</th>
          <th class="th-confidence">Confidence</th>
        </tr>
      </thead>
      <tbody>
        {active.map((r) => (
          <tr data-category={r.category}>
            <td class="td-partner"><a href={`/partners/${r.id}`}>{r.partner}</a></td>
            <td class="td-category"><span class={`cat-badge cat-${r.category}`}>{r.category}</span></td>
            <td class="td-purpose">{r.purpose}</td>
            <td class="td-confirmed">{r.last_confirmed}</td>
            <td class="td-confidence">{r.confidence}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</BaseLayout>

<style>
.filters {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
  flex-wrap: wrap;
  margin: var(--space-8) 0;
}

.filter-pill {
  background: transparent;
  border: 1px solid var(--ink-faint);
  color: var(--ink-muted);
  padding: var(--space-1) var(--space-3);
  border-radius: 16px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--size-sm);
  cursor: pointer;
  transition: all 0.15s;
}

.filter-pill:hover {
  border-color: var(--ink);
  color: var(--ink);
}

.filter-pill.active {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.partner-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--size-sm);
}

.partner-table th,
.partner-table td {
  text-align: left;
  padding: var(--space-3) var(--space-2);
  border-bottom: 1px solid var(--ink-faint);
}

.partner-table th {
  font-weight: 400;
  font-style: italic;
  color: var(--ink-muted);
  font-size: var(--size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.partner-table tr {
  transition: background 0.1s;
}

.partner-table tbody tr:hover {
  background: rgba(26, 22, 18, 0.04);
}

.cat-badge {
  font-size: var(--size-xs);
  font-style: italic;
}
.cat-silicon       { color: var(--cat-silicon); }
.cat-cloud         { color: var(--cat-cloud); }
.cat-vertical      { color: var(--cat-vertical); }
.cat-software      { color: var(--cat-software); }
.cat-interconnect  { color: var(--cat-interconnect); }
.cat-investment    { color: var(--cat-investment); }

.td-partner a { text-decoration: none; }
.td-partner a:hover { text-decoration: underline; }

.td-purpose {
  max-width: 380px;
  color: var(--ink-muted);
}
</style>

<script>
// Client-side filter pill behavior. No framework, just DOM.
const pills = document.querySelectorAll<HTMLButtonElement>('.filter-pill');
const rows = document.querySelectorAll<HTMLTableRowElement>('tbody tr[data-category]');

pills.forEach((pill) => {
  pill.addEventListener('click', () => {
    pills.forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    const target = pill.dataset.category;
    rows.forEach((row) => {
      const visible = target === 'all' || row.dataset.category === target;
      row.style.display = visible ? '' : 'none';
    });
  });
});
</script>
```

- [ ] **Step 2: Verify build and view**

```bash
npm run build && npm run dev
```

Visit `http://localhost:4321/list`. Should show 28 rows in a clean table with category-colored badges. Click filter pills — rows should hide/show by category. Clicking "all" should restore.

- [ ] **Step 3: Commit**

```bash
git add src/pages/list.astro
git commit -m "feat: add /list table view with category filter pills"
```

---

### Task 7: Partner detail page

**Files:**
- Create: `src/pages/partners/[id].astro`
- Create: `src/components/EvidenceTimeline.astro`

- [ ] **Step 1: Create `src/components/EvidenceTimeline.astro`**

```astro
---
// src/components/EvidenceTimeline.astro
interface Props {
  evidence_history: { url: string; date: string }[];
}

const { evidence_history } = Astro.props;
const sorted = [...evidence_history].sort((a, b) => b.date.localeCompare(a.date));
---
<ol class="timeline">
  {sorted.map((entry) => (
    <li class="timeline-entry">
      <time class="timeline-date">{entry.date}</time>
      <a class="timeline-link" href={entry.url} rel="noopener noreferrer" target="_blank">
        {new URL(entry.url).hostname}
      </a>
    </li>
  ))}
</ol>

<style>
.timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  border-left: 1px solid var(--ink-faint);
}

.timeline-entry {
  padding: var(--space-2) 0 var(--space-2) var(--space-4);
  position: relative;
  font-size: var(--size-sm);
}

.timeline-entry::before {
  content: "";
  position: absolute;
  left: -4px;
  top: var(--space-4);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink);
}

.timeline-date {
  display: inline-block;
  margin-right: var(--space-3);
  color: var(--ink-muted);
  font-style: italic;
  font-variant-numeric: tabular-nums;
}

.timeline-link {
  color: var(--ink);
}
</style>
```

- [ ] **Step 2: Create `src/pages/partners/[id].astro`**

```astro
---
// src/pages/partners/[id].astro
import BaseLayout from '~/layouts/BaseLayout.astro';
import Logo from '~/components/Logo.astro';
import EvidenceTimeline from '~/components/EvidenceTimeline.astro';
import { loadRelationships } from '~/lib/data';
import type { Relationship } from '~/lib/schema';

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
        <span class={`status-badge status-${rel.status}`}>{rel.status}</span>
        <span class="separator">·</span>
        <span class="confidence">{rel.confidence} confidence</span>
      </div>
    </header>

    <section class="partner-purpose">
      <p>{rel.purpose}</p>
    </section>

    {rel.notes && (
      <section class="partner-notes">
        <h2>Notes</h2>
        <p>{rel.notes}</p>
      </section>
    )}

    <section class="partner-evidence">
      <h2>Evidence</h2>
      {rel.evidence_history.length === 0 ? (
        <p class="muted">
          <a href={rel.evidence_url} rel="noopener noreferrer" target="_blank">
            {new URL(rel.evidence_url).hostname}
          </a>
          <span class="muted"> — {rel.last_confirmed}</span>
        </p>
      ) : (
        <EvidenceTimeline evidence_history={rel.evidence_history} />
      )}
    </section>

    <footer class="partner-footer muted">
      <span>First announced: {rel.first_announced}</span>
      <span class="separator">·</span>
      <span>Last confirmed: {rel.last_confirmed}</span>
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
  margin-bottom: var(--space-8);
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

.status-badge { font-style: italic; }
.status-active   { color: var(--ink); }
.status-dormant  { color: var(--ink-muted); }
.status-ended    { color: var(--ink-muted); text-decoration: line-through; }

.partner-purpose p {
  font-size: var(--size-lg);
  line-height: 1.6;
  font-style: italic;
  margin: var(--space-8) 0;
}

.partner-notes,
.partner-evidence {
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

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build generates one HTML file per partner under `dist/partners/`. 28 files for the 28 seeded partners.

- [ ] **Step 4: View a few**

```bash
npm run dev
```

Visit `http://localhost:4321/partners/tsmc`, `/partners/coreweave`, `/partners/mercedes-benz`. Each should render with logo (or fallback), name, category/status badges, purpose paragraph, evidence section, and back link.

- [ ] **Step 5: Commit**

```bash
git add src/pages/partners/ src/components/EvidenceTimeline.astro
git commit -m "feat: add partner detail pages with evidence timeline"
```

---

## Phase 4 — Graph component (sequential within, parallel with Phases 2/3)

### Task 8: Install Cytoscape and create base Graph component

**Files:**
- Modify: `package.json` (add cytoscape, cytoscape-cose-bilkent)
- Create: `src/components/Graph.astro`

- [ ] **Step 1: Install dependencies**

```bash
npm install cytoscape@3.30.0 cytoscape-cose-bilkent@4.1.0
npm install --save-dev @types/cytoscape@3.21.0
```

- [ ] **Step 2: Create `src/components/Graph.astro`**

```astro
---
// src/components/Graph.astro
// Renders a Cytoscape force-directed graph of NVIDIA partnerships.
// Client-hydrated; SSR renders an empty container.
import { loadRelationships } from '~/lib/data';

const relationships = loadRelationships().filter((r) => r.status === 'active');

// Build the elements array Cytoscape consumes.
// One central NVIDIA node + one node per partner + one edge per partner.
const elements = [
  {
    data: {
      id: 'nvidia',
      label: 'NVIDIA',
      kind: 'center'
    }
  },
  ...relationships.map((r) => ({
    data: {
      id: r.id,
      label: r.partner,
      kind: 'partner',
      category: r.category,
      confidence: r.confidence,
      evidenceCount: Math.max(1, r.evidence_history.length),
      logo: `/logos/${r.id}.svg`,
      partner: r.partner,
      purpose: r.purpose,
      lastConfirmed: r.last_confirmed
    }
  })),
  ...relationships.map((r) => ({
    data: {
      id: `e-${r.id}`,
      source: 'nvidia',
      target: r.id
    }
  }))
];

const elementsJson = JSON.stringify(elements);
---
<div id="graph-container" class="graph-container" data-elements={elementsJson}></div>

<style>
.graph-container {
  width: 100%;
  height: calc(100vh - 80px);
  min-height: 480px;
  position: relative;
  background: transparent;
}
</style>

<script>
import cytoscape from 'cytoscape';
// @ts-expect-error - cose-bilkent has no bundled types
import coseBilkent from 'cytoscape-cose-bilkent';

cytoscape.use(coseBilkent);

const container = document.getElementById('graph-container');
if (container) {
  const elements = JSON.parse(container.dataset.elements ?? '[]');

  const cy = cytoscape({
    container,
    elements,
    layout: { name: 'cose-bilkent', animate: false, fit: true, padding: 60, nodeRepulsion: 8000 },
    minZoom: 0.4,
    maxZoom: 2.5,
    style: [
      {
        selector: 'node[kind="center"]',
        style: {
          'background-color': '#1a1612',
          'label': 'NVIDIA',
          'color': '#f3ede0',
          'font-family': 'Georgia, serif',
          'font-style': 'italic',
          'font-size': 13,
          'font-weight': 700,
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 56,
          'height': 56,
          'border-width': 0
        }
      },
      {
        selector: 'node[kind="partner"]',
        style: {
          'background-color': 'transparent',
          'background-image': 'data(logo)',
          'background-fit': 'contain',
          'background-clip': 'none',
          'background-opacity': 0,
          'label': 'data(partner)',
          'color': '#1a1612',
          'font-family': 'Georgia, serif',
          'font-style': 'italic',
          'font-size': 9,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'text-opacity': 0,
          'width': (ele: cytoscape.NodeSingular) => 16 + Math.min(ele.data('evidenceCount'), 10) * 1.5,
          'height': (ele: cytoscape.NodeSingular) => 16 + Math.min(ele.data('evidenceCount'), 10) * 1.5,
          'border-width': 0
        }
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [40],
          'control-point-weights': [0.5],
          'line-color': '#1a1612',
          'line-opacity': 0.42,
          'width': 0.6,
          'target-arrow-shape': 'none',
          'source-arrow-shape': 'none'
        }
      }
    ]
  });

  // Expose for debugging
  (window as unknown as { cy?: cytoscape.Core }).cy = cy;
}
</script>
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds. Cytoscape is bundled into the client script for the homepage.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/Graph.astro
git commit -m "feat: add Cytoscape Graph component with editorial node/edge styles"
```

---

### Task 9: Hover behaviors with HoverCard

**Files:**
- Create: `src/components/HoverCard.astro`
- Modify: `src/components/Graph.astro`

- [ ] **Step 1: Create `src/components/HoverCard.astro`**

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
  </div>
</div>

<style>
.hover-card {
  position: absolute;
  background: var(--paper);
  border: 1px solid var(--ink);
  border-radius: 4px;
  padding: var(--space-3);
  width: 240px;
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

.hover-card-purpose {
  color: var(--ink);
  line-height: 1.4;
}
</style>
```

- [ ] **Step 2: Modify `src/components/Graph.astro` — add hover behavior**

Replace the `<script>` block at the bottom of `Graph.astro` with this expanded version (everything before `<script>` stays):

```typescript
import cytoscape from 'cytoscape';
// @ts-expect-error - cose-bilkent has no bundled types
import coseBilkent from 'cytoscape-cose-bilkent';

cytoscape.use(coseBilkent);

const container = document.getElementById('graph-container');
const hoverCard = document.getElementById('hover-card');
const hoverLogo = document.getElementById('hover-card-logo') as HTMLImageElement | null;
const hoverName = document.getElementById('hover-card-name');
const hoverMeta = document.getElementById('hover-card-meta');
const hoverPurpose = document.getElementById('hover-card-purpose');

if (container && hoverCard && hoverLogo && hoverName && hoverMeta && hoverPurpose) {
  const elements = JSON.parse(container.dataset.elements ?? '[]');

  const cy = cytoscape({
    container,
    elements,
    layout: { name: 'cose-bilkent', animate: false, fit: true, padding: 60, nodeRepulsion: 8000 },
    minZoom: 0.4,
    maxZoom: 2.5,
    style: [
      {
        selector: 'node[kind="center"]',
        style: {
          'background-color': '#1a1612',
          'label': 'NVIDIA',
          'color': '#f3ede0',
          'font-family': 'Georgia, serif',
          'font-style': 'italic',
          'font-size': 13,
          'font-weight': 700,
          'text-valign': 'center',
          'text-halign': 'center',
          'width': 56,
          'height': 56,
          'border-width': 0
        }
      },
      {
        selector: 'node[kind="partner"]',
        style: {
          'background-color': 'transparent',
          'background-image': 'data(logo)',
          'background-fit': 'contain',
          'background-clip': 'none',
          'background-opacity': 0,
          'label': 'data(partner)',
          'color': '#1a1612',
          'font-family': 'Georgia, serif',
          'font-style': 'italic',
          'font-size': 9,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'text-opacity': 0,
          'width': (ele: cytoscape.NodeSingular) => 16 + Math.min(ele.data('evidenceCount'), 10) * 1.5,
          'height': (ele: cytoscape.NodeSingular) => 16 + Math.min(ele.data('evidenceCount'), 10) * 1.5,
          'border-width': 0
        }
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [40],
          'control-point-weights': [0.5],
          'line-color': '#1a1612',
          'line-opacity': 0.42,
          'width': 0.6,
          'target-arrow-shape': 'none',
          'source-arrow-shape': 'none'
        }
      },
      {
        selector: '.dimmed',
        style: { 'opacity': 0.18 }
      },
      {
        selector: '.highlighted',
        style: { 'opacity': 1 }
      }
    ]
  });

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
    hoverMeta.textContent = `${data.category} · ${data.evidenceCount} confirmation${data.evidenceCount === 1 ? '' : 's'}`;
    hoverPurpose.textContent = data.purpose;

    const renderedPos = node.renderedPosition();
    const containerRect = container.getBoundingClientRect();
    hoverCard.style.left = `${containerRect.left + renderedPos.x + 30}px`;
    hoverCard.style.top = `${containerRect.top + renderedPos.y - 20}px`;
    hoverCard.dataset.visible = 'true';
  });

  cy.on('mouseout', 'node[kind="partner"]', () => {
    cy.elements().removeClass('dimmed').removeClass('highlighted');
    hoverCard.dataset.visible = 'false';
  });

  cy.on('tap', 'node[kind="partner"]', (evt) => {
    const id = evt.target.data('id');
    window.location.href = `/partners/${id}`;
  });

  (window as unknown as { cy?: cytoscape.Core }).cy = cy;
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/HoverCard.astro src/components/Graph.astro
git commit -m "feat: add hover highlight + tooltip and click-to-detail to graph"
```

---

### Task 10: FilterBar component for the graph

**Files:**
- Create: `src/components/FilterBar.astro`

- [ ] **Step 1: Create `src/components/FilterBar.astro`**

```astro
---
// src/components/FilterBar.astro
// Floating filter pills that toggle category visibility on the graph.
// Emits CustomEvents on the document; Graph.astro listens and applies CSS classes to nodes.
---
<div class="filter-bar" id="filter-bar">
  <button class="filter-pill" data-category="all" data-active="true">all</button>
  <button class="filter-pill" data-category="silicon">silicon</button>
  <button class="filter-pill" data-category="interconnect">interconnect</button>
  <button class="filter-pill" data-category="cloud">cloud</button>
  <button class="filter-pill" data-category="software">software</button>
  <button class="filter-pill" data-category="vertical">vertical</button>
  <button class="filter-pill" data-category="investment">investment</button>
</div>

<style>
.filter-bar {
  position: absolute;
  top: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: var(--space-2);
  z-index: 50;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 90vw;
}

.filter-pill {
  background: var(--paper);
  border: 1px solid var(--ink-faint);
  color: var(--ink-muted);
  padding: var(--space-1) var(--space-3);
  border-radius: 16px;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--size-xs);
  cursor: pointer;
  transition: all 0.15s;
}

.filter-pill[data-active="true"] {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.filter-pill:hover:not([data-active="true"]) {
  border-color: var(--ink);
  color: var(--ink);
}
</style>

<script>
const pills = document.querySelectorAll<HTMLButtonElement>('#filter-bar .filter-pill');
let activeCategory: string = 'all';

pills.forEach((pill) => {
  pill.addEventListener('click', () => {
    pills.forEach((p) => p.dataset.active = 'false');
    pill.dataset.active = 'true';
    activeCategory = pill.dataset.category ?? 'all';
    document.dispatchEvent(new CustomEvent('graph:filter', { detail: { category: activeCategory } }));
  });
});
</script>
```

- [ ] **Step 2: Modify `src/components/Graph.astro` — listen for filter event**

Add this code inside the `if (container && hoverCard...)` block, after the existing `cy.on('tap', ...)` line:

```typescript
  document.addEventListener('graph:filter', (e) => {
    const detail = (e as CustomEvent<{ category: string }>).detail;
    const cat = detail.category;
    if (cat === 'all') {
      cy.elements().removeClass('filtered-out');
    } else {
      cy.nodes('node[kind="partner"]').forEach((n) => {
        if (n.data('category') === cat) {
          n.removeClass('filtered-out');
          n.connectedEdges().removeClass('filtered-out');
        } else {
          n.addClass('filtered-out');
          n.connectedEdges().addClass('filtered-out');
        }
      });
    }
  });
```

Also add this to the style array (before the `.dimmed` selector entry):

```typescript
      {
        selector: '.filtered-out',
        style: { 'opacity': 0.06, 'text-opacity': 0 }
      },
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/FilterBar.astro src/components/Graph.astro
git commit -m "feat: add category FilterBar with graph dispatch event"
```

---

### Task 11: Idle ambient drift animation

**Files:**
- Modify: `src/components/Graph.astro`

- [ ] **Step 1: Add ambient drift to the Graph script**

In `Graph.astro`'s `<script>`, add this code at the very end, after the filter event listener:

```typescript
  // Ambient drift: gently nudge each partner node every ~2.5s along a small random vector.
  // Cytoscape recalculates edge curves automatically. Pauses on hover.
  let driftPaused = false;
  cy.on('mouseover', 'node', () => { driftPaused = true; });
  cy.on('mouseout', 'node', () => { driftPaused = false; });

  setInterval(() => {
    if (driftPaused) return;
    cy.nodes('node[kind="partner"]').forEach((node) => {
      const pos = node.position();
      const dx = (Math.random() - 0.5) * 1.2;
      const dy = (Math.random() - 0.5) * 1.2;
      node.animate({
        position: { x: pos.x + dx, y: pos.y + dy }
      }, { duration: 2400, easing: 'ease-in-out' });
    });
  }, 2500);
```

- [ ] **Step 2: Verify build**

```bash
npm run build && npm run dev
```

Expected: build succeeds. Once integrated into the homepage (Task 13), nodes will gently drift on idle.

- [ ] **Step 3: Commit**

```bash
git add src/components/Graph.astro
git commit -m "feat: add idle ambient drift animation to graph nodes"
```

---

### Task 12: Mobile fallback detection

**Files:**
- Modify: `src/components/Graph.astro`

- [ ] **Step 1: Add mobile detection at the top of the Graph script**

Insert this at the very start of the `<script>` block in `Graph.astro` (before the cytoscape import):

```typescript
// Mobile fallback: redirect to /list if the viewport is too narrow for the graph.
// Use a coarse-pointer media query to also catch tablets/touch devices.
const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
if (isMobile) {
  window.location.replace('/list');
  // Still load cytoscape below for desktop-resize edge cases — the redirect happens before paint.
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Test in dev**

```bash
npm run dev
```

In Chrome DevTools, toggle device toolbar (Ctrl+Shift+M), select a phone preset, and reload `http://localhost:4321/`. You should be redirected to `/list`. On desktop browser, no redirect.

- [ ] **Step 4: Commit**

```bash
git add src/components/Graph.astro
git commit -m "feat: redirect mobile/touch viewports from / to /list"
```

---

## Phase 5 — Homepage integration (sequential, depends on Phase 4)

### Task 13: Homepage using Graph + FilterBar + HoverCard

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Replace `src/pages/index.astro`**

```astro
---
import BaseLayout from '~/layouts/BaseLayout.astro';
import Graph from '~/components/Graph.astro';
import FilterBar from '~/components/FilterBar.astro';
import HoverCard from '~/components/HoverCard.astro';
import { loadRelationships } from '~/lib/data';

const all = loadRelationships();
const activeCount = all.filter((r) => r.status === 'active').length;
const lastUpdate = all.map((r) => r.last_confirmed).sort().at(-1) ?? '—';
---
<BaseLayout title="NVIDIA Tracker" pathname="/">
  <div class="home-frame">
    <header class="home-header">
      <h1 class="home-title">NVIDIA Ecosystem</h1>
      <p class="home-subtitle">{activeCount} active partnerships · last updated {lastUpdate}</p>
    </header>

    <FilterBar />
    <Graph />
    <HoverCard />
  </div>
</BaseLayout>

<style>
.home-frame {
  position: relative;
  width: 100%;
  height: calc(100vh - 80px);
  overflow: hidden;
}

.home-header {
  position: absolute;
  top: var(--space-4);
  left: var(--space-6);
  z-index: 10;
  pointer-events: none;
}

.home-title {
  font-size: var(--size-xl);
  font-style: italic;
  font-weight: 400;
  margin: 0;
}

.home-subtitle {
  font-size: var(--size-xs);
  color: var(--ink-muted);
  font-style: italic;
  margin: 0;
}
</style>
```

- [ ] **Step 2: Verify build and view**

```bash
npm run build && npm run dev
```

Visit `http://localhost:4321/`. Should see:
- Cream paper background
- Title "NVIDIA Ecosystem" top-left
- Filter pills top-center
- Graph filling the rest of the viewport with NVIDIA at center
- ~28 partner nodes around it, each with their logo (or text fallback)
- Hover a node: it lights up, others dim, tooltip card appears
- Click a node: navigates to `/partners/<id>`
- Click a filter pill: non-matching nodes fade

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: replace placeholder homepage with full graph dashboard"
```

---

### Task 14: Cross-route navigation polish

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Hide nav on the graph homepage** (it has its own header overlay; double nav is visually noisy)

Update the nav line in `BaseLayout.astro` to conditionally render:

Replace:

```astro
    <nav class="site-nav">
      <a href="/" {...activeClass('/')}>graph</a>
      <a href="/list" {...activeClass('/list')}>list</a>
      <a href="/about" {...activeClass('/about')}>about</a>
    </nav>
```

With:

```astro
    {pathname !== '/' && (
      <nav class="site-nav">
        <a href="/" {...activeClass('/')}>graph</a>
        <a href="/list" {...activeClass('/list')}>list</a>
        <a href="/about" {...activeClass('/about')}>about</a>
      </nav>
    )}
```

- [ ] **Step 2: Add a small "list / about" link cluster to the graph homepage**

In `src/pages/index.astro`, add inside the `home-frame` div (before `<FilterBar />`):

```astro
    <nav class="home-nav">
      <a href="/list">list</a>
      <a href="/about">about</a>
    </nav>
```

And add styles:

```css
.home-nav {
  position: absolute;
  top: var(--space-4);
  right: var(--space-6);
  z-index: 10;
  display: flex;
  gap: var(--space-4);
  font-size: var(--size-xs);
  font-style: italic;
}

.home-nav a {
  text-decoration: none;
  color: var(--ink-muted);
}

.home-nav a:hover { color: var(--ink); }
```

- [ ] **Step 3: Verify build and view all routes**

```bash
npm run build && npm run dev
```

Click between `/`, `/list`, `/about`, and a partner page. Navigation should feel coherent.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "feat: refine cross-route navigation"
```

---

### Task 15: Verify all tests still pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected: 28 + 6 (filters) = 34 tests passing.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: build succeeds, dist/ contains: `index.html`, `list/index.html`, `about/index.html`, `partners/<id>/index.html` for each of 28 partners, plus `_worker.js/`.

No commit (verification only).

---

## Phase 6 — Polish + Deploy

### Task 16: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Routes" section to README.md**

After the "Project layout" section, append:

```markdown
## Routes

- `/` — graph-first homepage (Cytoscape force-directed; mobile redirects to /list)
- `/list` — sortable table of all active partnerships with category filters
- `/partners/[id]` — detail page per partner with evidence timeline
- `/about` — methodology, what counts, what doesn't, the six categories

## Adding a new partner logo

Drop a transparent SVG at `public/logos/<id>.svg` (where `<id>` matches the entry's `id` in `data/relationships.json`). The Logo component will pick it up at next build. If no logo file exists, the partner is rendered as italic serif text.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document routes and logo conventions in README"
```

---

### Task 17: Smoke test all routes in production build

**Files:** none (verification only)

- [ ] **Step 1: Build and preview**

```bash
npm run build
npm run preview
```

(Wrangler dev should start on http://127.0.0.1:8787.)

- [ ] **Step 2: Manually visit each route**

- `http://127.0.0.1:8787/` — graph loads, NVIDIA in center, ~28 partners around, hover/click works, filter pills work
- `http://127.0.0.1:8787/list` — table renders, filter pills work
- `http://127.0.0.1:8787/about` — methodology page renders
- `http://127.0.0.1:8787/partners/tsmc` — detail page renders with logo, evidence section
- `http://127.0.0.1:8787/partners/coreweave` — same
- `http://127.0.0.1:8787/partners/mercedes-benz` — same

Open browser DevTools console — there should be NO red errors. Yellow warnings about Sharp are pre-existing and OK.

Stop wrangler with Ctrl+C.

No commit (verification only).

---

### Task 18: Deploy

**Files:** none (deploy only)

- [ ] **Step 1: Deploy to Cloudflare Workers**

```bash
npm run deploy
```

Expected: build runs, `dist/.assetsignore` is generated, wrangler uploads, URL printed.

- [ ] **Step 2: Verify live**

```bash
curl -sL -w "HTTP %{http_code}\n" https://nvidia-tracker.seanfkelley1.workers.dev | head -5
curl -sL -w "HTTP %{http_code}\n" https://nvidia-tracker.seanfkelley1.workers.dev/list -o /dev/null
curl -sL -w "HTTP %{http_code}\n" https://nvidia-tracker.seanfkelley1.workers.dev/about -o /dev/null
curl -sL -w "HTTP %{http_code}\n" https://nvidia-tracker.seanfkelley1.workers.dev/partners/tsmc -o /dev/null
```

All should return HTTP 200.

- [ ] **Step 3: Open the live site in your browser**

Visit https://nvidia-tracker.seanfkelley1.workers.dev — confirm the graph renders with logos, hover/click works, filter pills work.

- [ ] **Step 4: Commit any final changes if needed**

If any tweaks were made during smoke test:

```bash
git add .
git commit -m "chore: dashboard polish"
git push
```

If no changes — Plan B is complete.

---

## Self-Review Checklist (already performed)

**Spec coverage:**
- ✅ Editorial aesthetic (cream paper, Georgia serif, ink color, italic display) — Task 1
- ✅ Transparent logos at nodes — Task 4 + Task 8 background-image styling
- ✅ Force-directed layout (cose-bilkent) — Task 8
- ✅ Curved edges — Task 8 unbundled-bezier style
- ✅ Hover: highlight + dim + tooltip — Task 9
- ✅ Click → detail page — Task 9
- ✅ Filter pills — Task 10
- ✅ Idle ambient drift — Task 11
- ✅ Mobile fallback to /list — Task 12
- ✅ /list table with filters — Task 6
- ✅ /partners/[id] with evidence timeline — Task 7
- ✅ /about methodology — Task 5
- ✅ Logo size scales with evidence_history — Task 8 width/height functions
- ✅ Partner name fallback when no logo — Task 3 Logo component

**Type consistency check:**
- `Logo` component takes `{id, partner, size?, className?}` — used in Task 7 detail page consistently
- `EvidenceTimeline` takes `{evidence_history}` — matches schema field
- `Graph.astro` data passing via `data-elements` JSON attribute consistent throughout
- CustomEvent name `graph:filter` consistent between FilterBar dispatch and Graph listener

**Placeholder scan:**
- No "TBD", "TODO", "implement later" found
- All code blocks contain complete, runnable code
- All bash commands have expected outputs documented

**Parallelism map verified:**
- Tasks 1, 2, 3 must be sequential (later tasks import from these)
- Task 4 reads `data/relationships.json` (no writes); safe to run concurrent with Phase 3 + Phase 4
- Tasks 5, 6, 7 each create entirely separate files (no overlap); safe in parallel
- Tasks 8–12 all modify `Graph.astro`; must be sequential
- Tasks 13, 14 modify shared layout/page files; sequential after Phase 4
- Tasks 15–18 are verification/deploy; sequential

---
