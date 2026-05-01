# Nvidia Ecosystem Tracker

A web dashboard tracking Nvidia's public partnership ecosystem. Articles collected daily via GitHub Actions; partnerships extracted weekly in a manual Claude Code session.

See `docs/superpowers/specs/2026-04-28-nvidia-tracker-design.md` for the full design.

## Setup

### Prerequisites
- Node 20+
- npm
- Wrangler CLI (`npm install -g wrangler`) — already authenticated if you've used Cloudflare Workers before
- A Cloudflare account
- A Resend account (free tier) for the Sunday reminder email

### One-time install

```bash
npm install
```

### Local development

Run the placeholder site:
```bash
npm run dev
```

Run the test suite:
```bash
npm test
```

Run a manual collection (writes new articles to `raw/`):
```bash
npm run collect
```

Run the reminder script (without `RESEND_API_KEY`, just prints the body):
```bash
npm run remind
```

Validate the data files:
```bash
npm run validate-data
```

Build and preview as it'll run on Cloudflare Workers:
```bash
npm run preview
```

### Deploy

```bash
npm run deploy
```

(One-time: also run `wrangler login` and configure your account ID in `wrangler.toml` if not already.)

## Workflows

### Daily collection (automatic)
Runs every morning at 6am ET via `.github/workflows/collect.yml`. Fetches RSS + Nvidia newsroom, dedupes, commits to `raw/`.

### Weekly extraction (manual, ~10 minutes)
1. Open this folder in Claude Code
2. Type `/extract`
3. Walk through any new partnership proposals
4. Single commit ends the session

### Sunday reminder (automatic)
Runs every Sunday 9am ET. Sends email noting how many articles are waiting.

## GitHub secrets needed

- `RESEND_API_KEY` — from your Resend account dashboard
- `EMAIL_TO` — the address that receives the reminder

Set both in Settings → Secrets and variables → Actions.

## Data files

- `data/relationships.json` — source of truth (live partnerships)
- `data/pending.json` — review queue (proposed new partnerships)
- `raw/YYYY-MM-DD.json` — daily article archives, append-only
- `extraction_log.md` — append-only log of every REJECT/UPDATE/PROPOSE decision

See `CATEGORIES.md` for the partnership taxonomy and rules. See `extract_prompt.md` for the extraction prompt used by `/extract`.

## Project layout

See the spec doc for the full file tree.

## Routes

- `/` — graph-first homepage (Cytoscape force-directed; mobile redirects to /list)
- `/list` — sortable table of all active partnerships with category filters
- `/partners/[id]` — detail page per partner with evidence timeline
- `/about` — methodology, what counts, what doesn't, the six categories

## Adding a new partner logo

Drop a transparent SVG at `public/logos/<id>.svg` (where `<id>` matches the entry's `id` in `data/relationships.json`). The Logo component will pick it up at next build. If no logo file exists, the partner is rendered as italic serif text.
