# NVIDIA Tracker — Handoff Context

> **For a fresh Claude session.** Paste the contents of this file into a new session along with whatever specific task the user is asking about. This is everything you need to know to continue the work without the conversation history that produced it.

---

## What this project is

A personal web dashboard tracking NVIDIA's public partnership ecosystem. The site visualizes ~28 named partnerships across 6 categories (silicon, interconnect, cloud, software, vertical, investment) as a graph with NVIDIA at the center.

- **Live site:** https://nvidia-tracker.seanfkelley1.workers.dev
- **GitHub repo:** https://github.com/SeanK433/nvidia-tracker
- **Local working copy:** `C:\Users\skelley1\Claude Projects\nvidia-tracker`
- **Owner:** Sean Kelley (`seanfkelley1@gmail.com`), beginner-level developer who prefers clear step-by-step explanations.

The project follows three implementation plans (all executed):
- `docs/superpowers/plans/2026-04-28-data-and-pipelines.md` — Plan A: data layer + pipelines (collection, extraction, email reminder)
- `docs/superpowers/plans/2026-05-01-dashboard.md` — Plan B: the dashboard
- `docs/superpowers/plans/2026-05-02-milestones-and-significance.md` — Plan C: structured milestones + per-partner significance tier/narrative

Design specs:
- `docs/superpowers/specs/2026-04-28-nvidia-tracker-design.md` — original design
- `docs/superpowers/specs/2026-05-02-milestones-and-significance-design.md` — milestones + significance feature

---

## Current state

All three plans have been executed and deployed. The dashboard is live and renders 28 partners across 6 cluster columns. Each partner now has a structured milestone timeline + a significance tier (`core` / `significant` / `ancillary`) and a 1–2 sentence narrative explaining the economic stakes.

If you're picking up where things left off, the user is iterating on visual polish — they critique the live site and ask for fixes. The cycle has been: user sends screenshot → identify issues → dispatch focused fix → verify visually → repeat.

---

## Tech stack

- **Astro 4** + **`@astrojs/cloudflare`** adapter with `output: 'server'`
- **Cloudflare Workers** for hosting (deployed via `wrangler`)
- **TypeScript** throughout
- **Cytoscape.js 3.30** for the graph
- **Zod** for runtime schema validation
- **Vitest** for tests (58 tests passing)
- **rss-parser** + **cheerio** for the daily collection script
- **Resend** for the Sunday reminder email

---

## Repo layout (key files)

```
nvidia-tracker/
├── data/
│   ├── relationships.json     # 28 active partnerships (source of truth)
│   └── pending.json           # review queue (empty when no proposals waiting)
├── raw/                       # daily article archive, append-only
│   └── YYYY-MM-DD.json
├── public/
│   └── logos/                 # 29 SVG logos (28 partners + nvidia.svg for center)
├── scripts/
│   ├── collect.ts             # daily article collection (RSS + Nvidia newsroom)
│   ├── send-reminder.ts       # Sunday email via Resend
│   ├── sources.ts             # RSS feed list + relevance keywords
│   ├── validate-data.ts       # build-time JSON schema check
│   └── lib/                   # hash, dedup, fetch helpers
├── src/
│   ├── components/
│   │   ├── Graph.astro        # ★ the main visualization (Cytoscape + HTML logo overlays)
│   │   ├── HoverCard.astro    # tooltip skeleton; populated by Graph.astro on hover
│   │   ├── MilestoneTimeline.astro  # detail-page timeline (replaced EvidenceTimeline)
│   │   ├── FilterBar.astro    # category filter pills
│   │   └── Logo.astro         # used on detail pages (not the graph)
│   ├── pages/
│   │   ├── index.astro        # homepage = graph (prerender:true)
│   │   ├── list.astro         # table view (prerender:true)
│   │   ├── about.astro        # methodology page (prerender:true)
│   │   └── partners/[id].astro # detail per partner (prerender:true)
│   ├── layouts/
│   │   └── BaseLayout.astro   # shared chrome, hides nav on /
│   ├── lib/
│   │   ├── data.ts            # loadRelationships(), loadPending() — uses JSON imports
│   │   ├── filters.ts         # filter/sort helpers + latestMilestone, recentMilestonesForHover, sortByLatestMilestone
│   │   └── schema.ts          # Zod schemas: Relationship, Milestone, PendingProposal, Article, RawFile
│   └── styles/
│       └── theme.css          # design tokens, flat #f3ede0 background
├── .claude/
│   └── commands/
│       ├── extract.md              # /extract — weekly: classify articles, add milestones to existing partners, propose new
│       ├── seed-milestones.md      # /seed-milestones — one-time backfill (already run; refuses to re-run)
│       └── review-significance.md  # /review-significance — refresh tier+narrative for partners with new milestones
├── .github/workflows/
│   ├── collect.yml            # daily 6am ET cron
│   └── reminder.yml           # Sunday 9am ET cron
├── CATEGORIES.md              # partnership taxonomy + confidence rubric
├── extract_prompt.md          # how to classify articles into REJECT/UPDATE/PROPOSE
├── astro.config.mjs           # Astro + Cloudflare config
├── wrangler.toml              # Workers config (NOT Pages — single trunk Worker)
├── package.json
└── docs/
    ├── HANDOFF.md             # this file
    └── superpowers/
        ├── specs/
        └── plans/
```

---

## Critical gotchas (things that took hours to discover)

### 1. Pages are server-rendered by default — must add `prerender: true`

The Cloudflare adapter defaults to running every page on the worker at request time. Inside the Cloudflare Worker runtime, `node:fs.existsSync` and `process.cwd()` don't behave like local Node — they fail or return junk paths. Any Astro page using `node:fs` at module level **must** have `export const prerender = true;` at the top of its frontmatter, or it'll silently break in production while working locally.

Currently prerendered: `index.astro`, `list.astro`, `about.astro`, `partners/[id].astro`.

### 2. Cytoscape `background-fit: contain` is broken for SVGs with `preserveAspectRatio` or absolute units

Wide wordmark SVGs (Oracle, CoreWeave, Adobe, Microsoft, Schneider) clip horizontally instead of scaling down when used as Cytoscape node `background-image`. We tried every combination of `background-fit`, `background-clip`, `background-image-containment`, explicit pixel widths, sanitizing SVGs — nothing worked.

**The working solution:** render partner logos as HTML `<img>` overlays positioned over invisible Cytoscape nodes. The overlay layer (`#partner-logo-overlays`) is a div inside `#graph-container` at `z-index: 5`. Each logo is an absolutely-positioned `<img>` with `object-fit: contain`. Positions sync to Cytoscape nodes on every `render viewport pan zoom position` event. Filter dimming syncs through opacity changes.

Cytoscape's center NVIDIA node uses the same overlay technique for the same reason.

### 3. Cytoscape `preset` layout still applies `fit: true` by default

Even with explicit positions, Cytoscape calls `cy.fit()` after `preset` layout, which zooms in 1.17× and pans, undoing your positioning math. Always set `layout: { name: 'preset', fit: false }` plus explicit `zoom: 1`, `pan: { x: 0, y: 0 }`. The current Graph.astro also disables user pan/zoom (`userZoomingEnabled: false`, `userPanningEnabled: false`, `boxSelectionEnabled: false`, `autoungrabify: true`) since this is a static visualization.

### 4. Logo SVGs come with surprises

- Some have `preserveAspectRatio` attrs that defeat scaling (`oracle.svg`)
- Some use `width="198.72mm"` units that cause weird natural sizes (`coreweave.svg`)
- Some have explicit width/height that override viewBox (most of them)
- **One was actually broken: the original `schneider-electric.svg` only contained letter-paths spelling "Schneide" — the "r Electric" letters were missing from the file entirely.** Always verify SVG content matches what you expect by viewing it.
- We sanitized all SVGs once (stripping `preserveAspectRatio`, root-level `width`/`height`) — see commit `84d7db1`. New ones should follow the same pattern.

### 5. Aspect ratio detection at build time

`Graph.astro` reads each logo SVG's `viewBox` at build time to compute aspect ratio (`getLogoAspect()`), then sizes the partner node accordingly so the logo fits naturally. If a logo has no viewBox the function falls back to 1.85, which makes square nodes that may render small.

When sourcing a new logo, ensure it has a sensible `viewBox` matching the visible content bounds. If the SVG has a transform or clipPath that limits visible area to less than the viewBox, tighten the viewBox to match — otherwise the partner node will be over-sized with extra whitespace.

### 6. Cluster column-balance algorithm

`computePositions()` balances partners into K columns where K=1 for n≤1, K=2 for n in [2..8], K=3 for n≥9. `rowsPerCol = floor(n / K)`, with leftover partners (0, 1, or 2) placed as orphans on the outer side (away from NVIDIA). 1 orphan → centered at clusterX. 2 orphans → straddle clusterX at ±SUB_COL_SPACING/2. `SUB_COL_SPACING = 120` px tuned to avoid overlap with current logo sizes.

### 7. Schema invariants (Phase 4 cleanup)

`RelationshipSchema` enforces:
- Every partner has exactly **one** `establishment` milestone.
- `milestones[]` is in chronological order (oldest first).
- `significance_narrative` ≤ 280 chars; milestone `headline` ≤ 100, `description` ≤ 300.
- All four significance/milestone fields are required (no longer optional after Phase 4).

The legacy `evidence_quote` / `evidence_url` / `evidence_history` / `first_announced` fields were removed entirely — `MilestoneTimeline` rendering and `Established: <date>` on the detail page derive everything from `milestones`.

### 8. The dev port collides with the user's personal-website Astro

`localhost:4321` is often in use by the user's `seanfkelley1.com` personal-site dev server. If `npm run dev` here returns the personal site instead, start astro on a different port: `npm run dev -- --port 4322`. The `mcp__Claude_Preview__*` MCP tool also defaults to 4321 and will silently load whatever's there — so verify with curl or by checking the `<title>` tag.

---

## Layout geometry

The graph's center node is positioned at `(w/2, h * 0.56)` — slightly below center to leave room for the page title at top-left without partner logos overlapping it.

Each cluster has its label at `LABEL_OFFSET = 100` px from NVIDIA, with partners stacked outward from there:
- Top row (silicon, interconnect, cloud) at `cy_ - 100`, partners going UP
- Bottom row (software, vertical, investment) at `cy_ + 100`, partners going DOWN

`LOGO_SPACING = 36` px between rows. With 4 rows max per sub-column, top of cluster sits at `cy_ - 100 - 4*36 = cy_ - 244` (i.e., y ≈ 128 for a 665px viewport — well below the top of the canvas).

Three cluster X positions: `[w*0.18, w*0.50, w*0.82]`. Top row goes silicon/interconnect/cloud. Bottom row goes software/vertical/investment.

Six trunk lines from NVIDIA to each cluster's category-label node. Category labels have `width: 'label'` + `padding: 8px` + flat `#f3ede0` background, which paints a paper-colored rectangle behind the text occluding the trunk line.

---

## Design tokens (theme.css)

```css
--paper:  #f3ede0;   /* cream paper background, FLAT (no gradients) */
--ink:    #1a1612;   /* edges, partner names, headings */
--ink-muted:  #6b5d45;
--ink-faint:  rgba(26, 22, 18, 0.42);
```

Typography is Georgia serif throughout, italic for headlines and category labels. NVIDIA brand green (`#76b900`) appears only in the central bubble's logo.

---

## How the project runs

### Daily (automatic, no user action)
GitHub Action `.github/workflows/collect.yml` runs at 6am ET. Calls `scripts/collect.ts`. Fetches RSS feeds + scrapes the NVIDIA newsroom, dedupes against existing articles by URL hash, commits new articles to `raw/YYYY-MM-DD.json`. Uses GitHub bot for commits.

### Sunday (automatic email)
GitHub Action `.github/workflows/reminder.yml` at 9am ET. Calls `scripts/send-reminder.ts`. Counts (a) articles since the last extraction commit and (b) partners with milestones added since their `significance_reviewed_at`. Sends a single email with both queues. Short-circuits without sending if all queues are empty. Uses `RESEND_API_KEY` and `EMAIL_TO` GitHub secrets.

### Weekly (manual, two commands, ~10–20 min)

**1. `/extract`** (always run first). Instructs Claude to:
1. Read `CATEGORIES.md`, `extract_prompt.md`, `data/relationships.json`
2. Find articles in `raw/*.json` newer than the last `Week of YYYY-MM-DD` commit
3. Classify each: REJECT / UPDATE / PROPOSE NEW
4. For UPDATEs, decide **substantive** (append a milestone to the partner's `milestones[]`) vs **bare confirmation** (bump `last_confirmed` only)
5. For PROPOSE NEWs, draft the full new-shape skeleton (establishment milestone, significance tier + narrative) into `pending.json`. Auto-flag thin sourcing by downgrading `confidence` to `medium`.
6. Walk user through proposals (`keep` / `skip` / `edit`)
7. Commit with format `Week of YYYY-MM-DD: N updates, M new partners` (the prefix is parsed by send-reminder.ts)

**2. `/review-significance`** (run when the Sunday email surfaces partners with new milestones). Instructs Claude to:
1. For each partner, find milestones added since `significance_reviewed_at`. Skip if none.
2. Re-evaluate `significance_tier` and `significance_narrative` based on full milestone history. Tier should usually be preserved.
3. Walk user through partners where the draft differs from current
4. Bump `significance_reviewed_at` to today (whether `keep` or `skip`)
5. Commit `Significance review YYYY-MM-DD: N partners updated`

After both commands: `npm run deploy` to push.

### One-time setup (already done, here for reference)
- `wrangler login` — authenticated to Cloudflare via the user's account
- GitHub repo created at SeanK433/nvidia-tracker
- Resend account created, API key and recipient email added as GitHub secrets
- Initial seed pass populated 28 partners (relationships shape)
- `/seed-milestones` interactive backfill populated milestones + significance for all 28 (commit `febe11f`). The command refuses to re-run.

---

## Common commands

```bash
# Local dev
npm run dev                    # Astro dev server at localhost:4321

# Tests
npm test                       # 58 tests passing

# Build + preview
npm run build                  # outputs dist/
npm run preview                # wrangler dev (Workers runtime)

# Deploy
npm run deploy                 # builds + writes dist/.assetsignore + wrangler deploy

# Manual collection (writes new raw/ files)
npm run collect

# Test reminder script (no env vars set — prints body, no email)
npm run remind

# Validate data files against Zod schema
npm run validate-data
```

The `dist/.assetsignore` workaround: Cloudflare Workers complains that `_worker.js/` looks like server code masquerading as static assets. The deploy script writes `_worker.js` into a `.assetsignore` file inside `dist/` to suppress the upload-error.

---

## Tools that helped a lot

- **`Claude_in_Chrome` MCP** — navigate the live site, run JS in the page to inspect Cytoscape state. Critical for verifying that fixes actually landed visually.
- **`computer-use` MCP** — full-screen screenshots. Useful but **the Claude Code window masks most of the screen**, so the dashboard is often invisible. Best used when the user is actively viewing the dashboard tab and we just need a quick visual check of the visible edges.
- **Subagent dispatch (`Agent` tool)** — for focused fixes (sourcing a logo, applying a series of edits, doing structured research). Each subagent has fresh context, so they don't accumulate the controller's conversational baggage.

---

## Known cosmetic issues / things to watch

- **CoreWeave shows only the "CW" icon, no wordmark.** The original SVG had a 90-unit horizontal gap between the icon and "Weave" wordmark, so we cropped the viewBox to just the icon. Could be improved by sourcing a tighter SVG or hand-editing.
- **Vertical cluster (8 partners) makes the bottom heavier than the top.** Purely visual; not broken.
- **Two RSS feeds are dead** (Reuters tech 404, AnandTech malformed XML). They fail gracefully in the daily collection — just log a warning. Replacement feeds can be added by editing `scripts/sources.ts`.
- **Wrangler is on v3, with v4 available.** Not blocking but worth a routine update at some point.

---

## What the user might ask next

- "Make X bigger / smaller / different color" — typically a Cytoscape style edit in `Graph.astro` or a tweak to `theme.css`.
- "Source a logo for X" — add a SVG to `public/logos/<id>.svg`. The Logo component falls back to italic serif text if missing.
- "Add a new partner" — typically done via the weekly `/extract` flow rather than manually.
- "The site shows X but should show Y" — first verify it's not a browser cache issue (hard reload Ctrl+Shift+R), then check the schema of the underlying JSON, then trace through Graph.astro.
- "Run the weekly extraction" — type `/extract`. Walk through the proposals. Then `/review-significance` if there's a queue.
- "Update a significance narrative" — type `/review-significance`, or hand-edit the partner's `significance_*` fields in `data/relationships.json` and commit.
- "Add a milestone manually" — append to the partner's `milestones[]` array, maintaining chronological order. The Zod refinements will catch order violations and missing-establishment at build time.

---

## How to verify a change actually works

1. **Make the change** (edit a file, commit).
2. **Build:** `npm run build` — must complete without errors. Astro will fail the build if data files violate the Zod schema.
3. **Tests:** `npm test` — should still be 58 passing.
4. **Deploy:** `npm run deploy` — wait for "✨ Success!" and the deployed URL.
5. **Verify:** Use `Claude_in_Chrome` to navigate to the site with a cache-busting query string (e.g., `?cb=verify1`). Run JS to inspect Cytoscape state programmatically. Then ask the user to hard-reload and screenshot.
6. **Iterate based on the screenshot.**

When debugging visual issues, querying `cy.getElementById(<id>)` and reading its `.position()`, `.renderedPosition()`, `.width()`, `.height()`, `.style('property')` is the fastest way to understand what Cytoscape thinks the state is.

---

## Final note

The user values: clear step-by-step explanations, decisive recommendations (not endless options), self-verification before claiming a fix is done, and being told what's wrong even when they didn't ask. They appreciate when you flag your own mistakes proactively rather than waiting to be caught. They will tell you when to stop polishing.

You are walking into a project that mostly works. Your job is incremental polish — not a major rewrite.
