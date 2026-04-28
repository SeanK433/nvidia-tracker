# Nvidia Ecosystem Tracker — Design Spec

**Date:** 2026-04-28
**Status:** Approved (awaiting implementation plan)
**Owner:** Sean Kelley

---

## Summary

A web dashboard tracking Nvidia's public partnership ecosystem (silicon, interconnect, cloud, software, vertical, investment). Articles are collected daily via a GitHub Action; partnerships are extracted weekly in a manual Claude Code session. The dashboard is graph-first with an editorial cream-paper aesthetic and transparent partner logos rendered directly on the canvas.

The system is intentionally a hybrid of automated and manual: collection is hands-off, extraction is human-supervised. This trades a small amount of weekly time (~10 minutes) for $0 ongoing cost and high data quality.

## Goals

- A living public-facing dashboard of Nvidia partnerships, structured around the rules in `CATEGORIES.md`.
- Daily ingestion of new articles from a curated set of public sources.
- Weekly LLM-assisted extraction with human review before new partnerships go live.
- A distinctive, artistic graph-first visualization that feels like data art rather than a database UI.
- Sunday email reminder to nudge the weekly review session.
- $0/month operating cost.

## Non-goals

- Real-time updates (weekly cadence is intentional).
- Public crowd-sourced contributions or a CMS.
- A mobile-native experience (mobile gracefully falls back to a list view).
- Tracking partnerships of other companies (Nvidia-specific).
- Any commercial use, ads, or monetization (this is personal/editorial).

---

## System architecture

Six pieces, all in one GitHub repo:

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Repo (single repo)                    │
│                                                                  │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│   │ Daily Action │──▶│  raw/*.json  │   │ relationships.   │    │
│   │  (collection)│   │              │   │      json        │    │
│   └──────────────┘   └──────────────┘   └────────┬─────────┘    │
│          ▲                   │                    ▲              │
│          │                   ▼                    │              │
│   RSS feeds +       ┌──────────────────┐ appends │              │
│   Nvidia            │  YOU + Claude    │ & edits │              │
│   newsroom          │  Code session    │─────────┘              │
│                     │  (weekly extract)│                         │
│                     └──────────────────┘                         │
│                            │                                     │
│                            ▼                                     │
│                   ┌──────────────────┐                          │
│                   │  pending.json    │                          │
│                   │ (review queue)   │                          │
│                   └──────────────────┘                          │
│                                                                  │
│   ┌──────────────┐                                              │
│   │Sunday Action │──▶ email via Resend                          │
│   │  (reminder)  │                                              │
│   └──────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
                            │ on every push to main
                            ▼
                ┌─────────────────────────────┐
                │  Cloudflare Workers build   │
                │  (Astro static rebuild)     │
                └─────────────────────────────┘
                            │
                            ▼
                ┌─────────────────────────────┐
                │  the dashboard              │
                └─────────────────────────────┘
```

**Stack:** Astro + Cloudflare Workers (matches Sean's personal site stack). TypeScript throughout. Cytoscape.js for graph rendering.

**Storage:** Plain JSON files in the git repo. No database. Git history is the data history.

---

## Repo layout

```
nvidia-tracker/
├── data/
│   ├── relationships.json     # source of truth (live partnerships)
│   └── pending.json           # review queue (proposed new partnerships)
├── raw/                       # daily article archive (append-only)
│   └── 2026-04-28.json
├── public/
│   └── logos/                 # partner SVG logos, transparent background
│       └── tsmc.svg
├── scripts/
│   ├── collect.ts             # RSS + scrape, called by daily Action
│   ├── send-reminder.ts       # email, called by Sunday Action
│   └── sources.ts             # list of RSS feeds and scrape targets
├── src/                       # Astro site
│   ├── pages/
│   │   ├── index.astro        # graph-first homepage
│   │   ├── list.astro         # mobile/secondary list view
│   │   ├── partners/
│   │   │   └── [id].astro     # detail page per partner
│   │   └── about.astro        # methodology page
│   ├── components/
│   │   ├── Graph.astro        # Cytoscape canvas
│   │   ├── PartnerNode.astro  # logo + label rendering
│   │   ├── HoverCard.astro    # tooltip on hover
│   │   └── FilterBar.astro    # category/status filters
│   └── lib/
│       ├── data.ts            # loads + validates relationships.json
│       └── schema.ts          # JSON schema definitions
├── .claude/
│   └── commands/
│       └── extract.md         # /extract slash command
├── .github/workflows/
│   ├── collect.yml            # daily 6am ET cron
│   └── reminder.yml           # Sunday 9am ET cron
├── CATEGORIES.md              # taxonomy and rules (already authored)
├── extract_prompt.md          # the extraction prompt (already authored)
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-28-nvidia-tracker-design.md   # this doc
├── astro.config.mjs
├── wrangler.toml              # Cloudflare Workers config
├── package.json
└── README.md
```

---

## Data model

### `data/relationships.json`

The live dataset. An array of partnership objects matching `CATEGORIES.md`, with one addition: `evidence_history` for tracking every confirmation, and an `id` field (lowercase slug) for clean URLs.

```json
[
  {
    "id": "tsmc",
    "partner": "TSMC",
    "category": "silicon",
    "purpose": "Manufactures Nvidia's leading-edge GPUs on N4 and N3 process nodes",
    "evidence_quote": "Nvidia and TSMC deepen advanced packaging collaboration",
    "evidence_url": "https://nvidianews.nvidia.com/...",
    "evidence_history": [
      { "url": "https://...", "date": "2026-04-15" },
      { "url": "https://...", "date": "2025-11-02" }
    ],
    "first_announced": "2020-01-01",
    "last_confirmed": "2026-04-15",
    "status": "active",
    "confidence": "high",
    "notes": ""
  }
]
```

`id` is required and globally unique. Generated as a lowercase slug of `partner` (e.g., "Mercedes-Benz" → "mercedes-benz"). When two partners would slug to the same id, append a disambiguator (e.g., "foxconn-silicon" vs "foxconn-robotics" if needed for the rare distinct-roles case).

### `data/pending.json`

Same shape as `relationships.json` but each entry carries one extra field: `proposed_from_article` (the URL that triggered the proposal) for traceability. Empty array `[]` after each weekly review.

### `raw/YYYY-MM-DD.json`

Daily article dumps from the collection Action. Append-only.

```json
{
  "fetched_at": "2026-04-28T11:00:00Z",
  "articles": [
    {
      "id": "sha256-of-url",
      "url": "https://...",
      "title": "...",
      "published_at": "2026-04-27",
      "source": "nvidia-newsroom",
      "body_text": "..."
    }
  ]
}
```

`id` is `sha256(url)` for dedup. The collection script reads all existing IDs across `raw/` before writing — never reprocesses an article.

### `extraction_log.md`

Append-only log of every extraction decision (REJECT / UPDATE / PROPOSE). Format per `extract_prompt.md`:

```
## [date] [article_id]
Headline: ...
Decision: REJECT | UPDATE | PROPOSE
Reason / changes: one or two sentences
```

Used to spot patterns ("we keep rejecting these in a way that suggests we should refine the rubric").

### Schema validation

`src/lib/schema.ts` defines TypeScript types and runtime validators (Zod or similar) for `relationships.json` and `pending.json`. Astro fails the build if either file violates the schema. **This is the most important data guard.**

---

## Daily collection pipeline

A single TypeScript script (`scripts/collect.ts`) run by `.github/workflows/collect.yml` at 6am ET daily.

**Sources** (defined in `scripts/sources.ts`):

| Type | Name | URL |
|------|------|-----|
| RSS | Nvidia blog | `https://blogs.nvidia.com/feed/` |
| Scrape | Nvidia newsroom | `https://nvidianews.nvidia.com/news` |
| RSS | SemiAnalysis | resolved at implementation |
| RSS | The Information (Nvidia tag) | resolved at implementation |
| RSS | Reuters tech | resolved at implementation |
| RSS | IEEE Spectrum | resolved at implementation |
| RSS | AnandTech | resolved at implementation |

Specific RSS URLs are sourced during the implementation phase (each publication's `/feed` endpoint, verified working). The list is intentionally living — new sources are added by editing `sources.ts` and committing.

**Script behavior:**

1. For each source, fetch articles published in the last 7 days (overlap window catches late-arriving content; dedup handles duplicates).
2. Filter for Nvidia relevance: keep articles where the title or first 500 chars contain "Nvidia" or related keywords (NVLink, CUDA, Blackwell, Hopper, Grace, etc.). Naive but high recall — the LLM extraction step does the real judgment.
3. Compute `id = sha256(url)`. Read all existing IDs across `raw/*.json`. Skip duplicates.
4. Write to `raw/YYYY-MM-DD.json`. If today's file exists (e.g., re-run), append rather than overwrite.
5. Commit and push using the Action's built-in `GITHUB_TOKEN`. No extra secrets needed.

**Reliability:**
- Each source wrapped in try/catch. One failure does not abort others.
- `User-Agent: nvidia-tracker (seanfkelley1@gmail.com)` so site owners know who's hitting them.
- 2-second polite delay between scrape requests.
- Failures logged to Action output, surfaced in next Sunday email.
- The `raw/` directory is append-only forever. Articles are never deleted.

**Storage:** ~50 articles/week × ~5KB each = ~13MB/year. Negligible for a git repo.

---

## Weekly extraction pipeline

The only recurring manual step. Triggered by the user typing `/extract` in a Claude Code session.

**Setup (one-time):** `.claude/commands/extract.md` defines the slash command. Its body is the contents of `extract_prompt.md` plus instructions for interactive walk-through.

**Session flow:**

1. User types `/extract`.
2. Claude reads three things into context:
   - `CATEGORIES.md` (rules)
   - `data/relationships.json` (current state, used to classify UPDATE vs PROPOSE NEW)
   - All `raw/*.json` files newer than the last extraction commit (determined by scanning `git log` for commits matching the pattern `Week of YYYY-MM-DD`)
3. Classify each article: REJECT / UPDATE / PROPOSE NEW.
4. **Auto-apply UPDATEs to `relationships.json`:**
   - Append article URL to `evidence_history`
   - Bump `last_confirmed` to article date
   - No human review (these are freshness updates to already-approved partners)
5. **Append PROPOSE NEWs to `pending.json`** with full proposed entry plus `proposed_from_article`.
6. **Append REJECTs to `extraction_log.md`** as one-line summaries.
7. Report summary:
   ```
   Processed 47 articles since 2026-04-21.
   ✓ 38 rejected (mostly product launches and earnings)
   ✓ 6 updates applied (TSMC, Foxconn, CoreWeave, Lambda, Mercedes-Benz, Schneider Electric)
   ⚠ 3 new proposals waiting your review

   Walk through them?
   ```
8. User confirms. Claude shows each proposal one at a time:
   ```
   Proposal 1 of 3 — Astera Labs
   ─────────────────────────────
   Category: interconnect
   Purpose:  NVLink Fusion ecosystem partner for retimers
   Source:   nvidia.com/blog/astera-nvlink-fusion (2026-04-22)
   Quote:    "Astera Labs joins Nvidia's NVLink Fusion ecosystem"
   Confidence: high

   [keep] [skip] [edit]
   ```
9. User responds:
   - `keep` → move from `pending.json` to `relationships.json`, generate `id` slug
   - `skip` → remove from `pending.json`, log to `extraction_log.md`
   - `edit <change>` → apply change, ask again
10. After all proposals reviewed, single commit:
    ```
    Week of 2026-04-28: 6 updates, 2 new partners

    Added:
      - Astera Labs (interconnect)
      - MediaTek (interconnect)
    Updated:
      - TSMC, Foxconn, CoreWeave, Lambda, Mercedes-Benz, Schneider Electric
    Rejected: 38 articles (see extraction_log.md)
    ```
11. Cloudflare Workers picks up the push, redeploys. Dashboard updates within ~30 seconds.

**If a week is skipped:** articles accumulate in `raw/`, next session processes the backlog. Nothing breaks.

**If Claude misclassifies an UPDATE:** caught in periodic audit (every few months scan recent commits). `git revert` if needed.

---

## Dashboard

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Graph-first homepage (the centerpiece) |
| `/list` | Sortable/filterable table — mobile fallback and quick lookups |
| `/partners/[id]` | Detail page per partner |
| `/about` | Methodology, rules, data sources, how to flag corrections |

Astro reads `data/relationships.json` at build time. `/`, `/list`, and `/about` are static HTML. `/partners/[id]` generates one HTML file per partner via Astro's static dynamic routes. Cytoscape JS bundle is loaded only on `/`.

### Visual aesthetic — editorial / etched

- **Background:** cream paper `#f3ede0` with subtle radial-gradient texture (suggests aged paper without literal noise overlay).
- **Ink color:** `#1a1612` for typography and edges.
- **Typography:** Georgia (serif) for headlines, italic for tagline, body in serif at small sizes.
- **Edges:** thin Bezier curves, `stroke="#1a1612"`, `stroke-opacity≈0.42`, `stroke-width≈0.5`.
- **Center node ("NVIDIA"):** dark filled circle `#1a1612` with cream wordmark in italic Georgia.
- **Partner nodes:** transparent SVG logos placed directly on the cream background. Brand colors render as accents against the unified ground. No solid backgrounds behind logos.
- **Logo source:** Wikimedia Commons SVGs, manually cleaned for transparency, stored at `public/logos/[id].svg`.
- **Logo size:** scales with `evidence_history.length` — more confirmations = larger render. Range: ~10px (single confirmation) to ~24px (10+ confirmations).
- **Fallback when no logo available** (or logo fails to render on cream — e.g., white-on-X marks): partner name rendered as serif italic text in `#1a1612`.
- **Category color accents:** used for filter pills, hover highlights, and the legend at the bottom of the canvas. Not on nodes themselves (the logos carry their own brand color).
  - silicon: `#8b2c1f` (deep red)
  - cloud: `#2c3e60` (navy)
  - vertical: `#a8721c` (ochre)
  - software: `#3a5c3a` (forest)
  - interconnect: `#8b2c1f` outline (matches silicon family)
  - investment: `#3a5c3a` outline (matches software family)

### Graph behavior

- **Layout:** force-directed via Cytoscape's `cose-bilkent` or similar. Nodes find their own positions; collision detection prevents overlap.
- **Edges curved:** Bezier with subtle control point offset for organic feel.
- **Hover:** highlighted node + connected edges become full-opacity; all other nodes/edges dim to ~25% opacity. A floating tooltip card appears next to the node showing: full-color logo (slightly larger), partner name, category, `last_confirmed` date, and `evidence_history.length`.
- **Click:** smooth zoom + transition to `/partners/[id]`.
- **Idle:** gentle ambient drift — nodes oscillate ±2px on Perlin noise paths so the canvas always feels alive without distracting motion.
- **Filter bar:** sits unobtrusively at top of canvas. Toggles for category (multi-select pills) and status (active / dormant / show-all). When a filter is toggled, hidden nodes fade and the layout re-runs (smooth transition).
- **Search:** small text input at top-right of canvas. Typing dims all nodes that don't match; the matching node centers and pulses briefly.

### Detail page (`/partners/[id]`)

- Header: full-color logo (large, ~120px), partner name, category badge, status pill.
- Purpose paragraph (from `purpose`).
- Evidence timeline: vertical list of `evidence_history`, oldest at bottom. Each entry: date, source (linked), and quote from initial entry where available.
- Notes block (if `notes` is non-empty).
- Footer: "First announced: YYYY-MM-DD · Last confirmed: YYYY-MM-DD · Confidence: high/medium/low"
- Bottom nav: "← back to graph" link, no other site chrome.

### List view (`/list`)

- Sortable table: Partner | Category | Status | First announced | Last confirmed | Confidence.
- Filter pills above table (same as graph).
- Search box.
- Click row → goes to `/partners/[id]`.
- This is the mobile primary view (graph doesn't reflow).
- On desktop, accessible via small "list view" link in graph corner.

### About page (`/about`)

Plain editorial prose. Sections:
- What this is
- What counts as a partnership (paraphrase of `CATEGORIES.md`)
- Where the data comes from (sources list)
- How confidence is assessed
- How to flag corrections (email link)
- Methodology limitations and known gaps

---

## Email reminder

`.github/workflows/reminder.yml` runs every Sunday at 9am ET. Calls `scripts/send-reminder.ts` which:

1. Reads `git log` for the most recent commit matching `Week of YYYY-MM-DD`. Computes days since.
2. Counts articles in `raw/*.json` files newer than that commit.
3. Counts current entries in `data/pending.json`.
4. Renders short email body via plain string template:
   ```
   Subject: NV Tracker — N articles ready for review

   It's been D days since your last extraction.
   New articles: N
   Pending review queue: P

   Open Claude Code and run /extract when you're ready.

   <link to dashboard>
   ```
5. POSTs to Resend API. Uses `RESEND_API_KEY` and `EMAIL_TO` GitHub secrets.

If `RESEND_API_KEY` is missing, the script logs a warning and exits cleanly (does not fail the workflow).

---

## Error handling

| Failure | Behavior | Recovery |
|---------|----------|----------|
| Single RSS feed returns 5xx | Logged, other sources continue | None unless persistent |
| Nvidia newsroom HTML structure changes | Logged, no articles from that source | Open Claude Code: "the scraper for Nvidia newsroom is broken, fix it" |
| Resend API key invalid or quota exceeded | Sunday Action shows red on GitHub | Fix the secret; manually re-trigger if desired |
| Cloudflare Workers build fails (bad JSON commit) | Site stops updating, Cloudflare emails build error | Read build log, `git revert` the offending commit |
| Claude misclassifies an UPDATE during extraction | Wrong partner gets bumped `last_confirmed` | Periodic audit of recent commits; `git revert` if found |
| Logo missing or doesn't render on cream | Falls back to serif italic text label | Source the SVG and add to `public/logos/[id].svg` |
| Partner name slug collision | Schema validator fails the build | Manual disambiguator on the new entry |
| GitHub Action exceeds quota (free tier: 2K min/mo private) | Action queues / fails | Move repo to public (unlimited Action minutes) or trim collection scope |

**Principle:** every part of the pipeline is read-only against external systems and write-only to git. There is no live database to corrupt. Worst-case recovery for any failure is `git revert`.

---

## Testing

Light, on purpose.

- **TypeScript everywhere.** Type errors caught at build time.
- **Schema validation** on `relationships.json` and `pending.json` at Astro build time. Build fails on invalid data.
- **One unit test for dedup logic** in `scripts/collect.ts` (hash collision behavior).
- **No tests for Astro components.** They render static data; if the page builds and looks right in the browser, it's working.
- **Manual smoke test after deploy:** load site, click 2-3 partners, toggle a filter. ~30 seconds.

If the project grows beyond personal scope, expand testing. Not before.

---

## Cost & scale

| Item | Cost | Notes |
|------|------|-------|
| Cloudflare Workers hosting | $0 | Free tier covers this scale indefinitely |
| GitHub repo + Actions | $0 | Public repo: unlimited Action minutes |
| Resend (Sunday email) | $0 | Free tier: 100/day; we use 1/week |
| Domain (optional) | $0–$15/yr | Use `*.workers.dev` subdomain to stay $0 |
| Claude Code subscription | already paid | User's existing subscription covers extraction sessions |
| **Total ongoing** | **$0/month** | |

**Scale ceiling for current architecture:**
- ~500 partnerships before graph rendering needs optimization
- ~5K articles in `raw/` before git operations slow noticeably
- Both well above any realistic personal-tracker volume.

---

## One-time setup checklist

(For the implementation phase. Not part of this spec, but listed here for completeness.)

1. Astro project scaffold + Cloudflare Workers config.
2. JSON schema definitions in `src/lib/schema.ts`.
3. Empty `data/relationships.json` and `data/pending.json` placeholders.
4. RSS feed list in `scripts/sources.ts`.
5. `scripts/collect.ts` implementation.
6. `scripts/send-reminder.ts` implementation.
7. GitHub Action workflows (collect + reminder).
8. Resend account + secrets configuration.
9. `/extract` slash command file.
10. Dashboard implementation (graph, detail pages, list view, about page).
11. Logo sourcing for ~30 initial partners.
12. **Initial seed session** — Sean opens Claude Code: *"do the seed pass."* Claude does ~1 hour of structured research on public sources, populates `relationships.json` with ~30 well-known partners (TSMC, SK Hynix, Foxconn, CoreWeave, Mercedes-Benz, etc.) per the `CATEGORIES.md` rubric.
13. Cloudflare Workers deploy.
14. Smoke test the dashboard.

---

## References

- `CATEGORIES.md` — partnership taxonomy, six categories, confidence rubric, status lifecycle
- `extract_prompt.md` — extraction process (REJECT / UPDATE / PROPOSE NEW), hard rules, output format
- Visual mockups (aesthetic exploration, in parent directory, not in this repo): `../.superpowers/brainstorm/3529-1777403041/content/` — final direction is `logos-transparent.html`
- Personal-website precedent: Astro on Cloudflare Workers (Sean's existing site, same stack)

---

## Open questions for implementation phase

- Specific Resend account setup (Sean to create during implementation).
- Exact Astro + Cloudflare Workers template — start fresh or fork from personal-website?
- Whether to include a "submit a correction" form on `/about` (mailto: link is enough for v1).
- Logo sourcing automation — manual for v1; consider Wikimedia Commons API later if it becomes a bottleneck.
