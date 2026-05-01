# Plan A — Data Layer & Pipelines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data layer, collection pipeline, extraction workflow, and email reminder for the Nvidia ecosystem tracker. After this plan: articles flow daily into the repo, the `/extract` slash command processes new articles into `relationships.json`, Sunday emails arrive, and the site deploys with a placeholder home page (the dashboard build happens in Plan B).

**Architecture:** Single Astro + Cloudflare Workers repo. JSON files in git as the data layer. Daily GitHub Action runs `scripts/collect.ts` (RSS feeds + Nvidia newsroom scrape, dedupes, commits). Manual `/extract` slash command in Claude Code reads raw articles + relationships.json + CATEGORIES.md, classifies REJECT/UPDATE/PROPOSE NEW, applies UPDATEs directly, queues NEW for human review. Sunday GitHub Action runs `scripts/send-reminder.ts` to email the user via Resend.

**Tech Stack:** TypeScript, Astro 4, Cloudflare Workers (wrangler), Vitest (testing), Zod (schema validation), rss-parser, cheerio (HTML scraping), Resend (transactional email).

---

## Prerequisites

Before starting, the implementer should have:
- Node 20+ and npm installed
- Wrangler CLI installed and authenticated (`wrangler login`) — Sean already has this from personal-website
- This repo cloned at `C:\Users\skelley1\Claude Projects\nvidia-tracker`
- The spec at `docs/superpowers/specs/2026-04-28-nvidia-tracker-design.md` open for reference

The Resend account is created later (Phase 5). No need to set it up first.

---

## Phase 1 — Project foundation

### Task 1: Initialize package.json

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package.json with all dependencies pinned**

```json
{
  "name": "nvidia-tracker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "wrangler dev",
    "deploy": "astro build && wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest",
    "collect": "tsx scripts/collect.ts",
    "remind": "tsx scripts/send-reminder.ts",
    "validate-data": "tsx scripts/validate-data.ts"
  },
  "dependencies": {
    "@astrojs/cloudflare": "^11.0.0",
    "astro": "^4.16.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "cheerio": "^1.0.0",
    "resend": "^3.5.0",
    "rss-parser": "^3.13.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "wrangler": "^3.78.0"
  }
}
```

- [ ] **Step 2: Run install and confirm**

```bash
npm install
```

Expected: `node_modules/` directory created, no errors. Warnings about peer deps are OK.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: initialize package.json with dependencies"
```

---

### Task 2: Add tsconfig.json

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"]
    },
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*", "scripts/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", ".astro"]
}
```

- [ ] **Step 2: Verify TypeScript can parse it**

```bash
npx tsc --noEmit
```

Expected: no output (success). May error on missing files since src/ doesn't exist yet — that's fine, will be fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add TypeScript strict config"
```

---

### Task 3: Configure Astro for Cloudflare Workers

**Files:**
- Create: `astro.config.mjs`

- [ ] **Step 1: Create Astro config**

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    platformProxy: { enabled: true }
  }),
  site: 'https://nvidia-tracker.your-subdomain.workers.dev',
  build: {
    assets: 'assets'
  }
});
```

Note: The `site` URL is a placeholder — update it to the actual workers.dev URL after first deploy in Task 32.

- [ ] **Step 2: Commit**

```bash
git add astro.config.mjs
git commit -m "chore: configure Astro for Cloudflare Workers"
```

---

### Task 4: Add wrangler.toml

**Files:**
- Create: `wrangler.toml`

- [ ] **Step 1: Create wrangler config**

```toml
name = "nvidia-tracker"
compatibility_date = "2026-04-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./dist"

[observability]
enabled = true
```

- [ ] **Step 2: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add Cloudflare Workers wrangler config"
```

---

### Task 5: Set up vitest

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text']
    }
  },
  resolve: {
    alias: {
      '~': '/src'
    }
  }
});
```

- [ ] **Step 2: Create a sanity-check test**

Create file `tests/sanity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run it**

```bash
npm test
```

Expected: `1 passed`

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/sanity.test.ts
git commit -m "chore: set up vitest with sanity test"
```

---

### Task 6: Create empty data files

**Files:**
- Create: `data/relationships.json`
- Create: `data/pending.json`
- Create: `raw/.gitkeep`

- [ ] **Step 1: Create empty data files**

`data/relationships.json`:
```json
[]
```

`data/pending.json`:
```json
[]
```

Create empty placeholder for raw directory:
```bash
touch raw/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add data/relationships.json data/pending.json raw/.gitkeep
git commit -m "chore: add empty data files and raw directory"
```

---

## Phase 2 — Data schemas

### Task 7: Define Relationship schema

**Files:**
- Create: `src/lib/schema.ts`
- Test: `tests/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { RelationshipSchema } from '../src/lib/schema';

describe('RelationshipSchema', () => {
  it('accepts a valid relationship', () => {
    const valid = {
      id: 'tsmc',
      partner: 'TSMC',
      category: 'silicon',
      purpose: 'Manufactures Nvidia GPUs',
      evidence_quote: 'TSMC partners with Nvidia',
      evidence_url: 'https://example.com',
      evidence_history: [{ url: 'https://example.com', date: '2026-04-15' }],
      first_announced: '2020-01-01',
      last_confirmed: '2026-04-15',
      status: 'active',
      confidence: 'high',
      notes: ''
    };
    expect(() => RelationshipSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid category', () => {
    const invalid = { id: 'x', partner: 'X', category: 'bogus' };
    expect(() => RelationshipSchema.parse(invalid)).toThrow();
  });

  it('rejects a non-slug id', () => {
    const invalid = {
      id: 'TSMC',
      partner: 'TSMC',
      category: 'silicon',
      purpose: 'x',
      evidence_quote: 'x',
      evidence_url: 'https://x.com',
      evidence_history: [],
      first_announced: '2020-01-01',
      last_confirmed: '2026-04-15',
      status: 'active',
      confidence: 'high',
      notes: ''
    };
    expect(() => RelationshipSchema.parse(invalid)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
npm test -- tests/schema.test.ts
```

Expected: tests fail with `Cannot find module '../src/lib/schema'`

- [ ] **Step 3: Write the schema**

Create `src/lib/schema.ts`:

```typescript
import { z } from 'zod';

export const CategorySchema = z.enum([
  'silicon',
  'interconnect',
  'cloud',
  'software',
  'vertical',
  'investment'
]);

export const StatusSchema = z.enum(['active', 'dormant', 'ended']);

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const EvidenceEntrySchema = z.object({
  url: z.string().url(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
});

export const RelationshipSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase slug'),
  partner: z.string().min(1),
  category: CategorySchema,
  purpose: z.string().min(1),
  evidence_quote: z.string().max(200),
  evidence_url: z.string().url(),
  evidence_history: z.array(EvidenceEntrySchema),
  first_announced: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  last_confirmed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: StatusSchema,
  confidence: ConfidenceSchema,
  notes: z.string()
});

export type Relationship = z.infer<typeof RelationshipSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npm test -- tests/schema.test.ts
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts tests/schema.test.ts
git commit -m "feat: add Relationship Zod schema with validation tests"
```

---

### Task 8: Define PendingProposal and Article schemas

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `tests/schema.test.ts`

- [ ] **Step 1: Add tests for new schemas**

Append to `tests/schema.test.ts`:

```typescript
import { PendingProposalSchema, ArticleSchema, RawFileSchema } from '../src/lib/schema';

describe('PendingProposalSchema', () => {
  it('accepts a relationship plus proposed_from_article', () => {
    const valid = {
      id: 'astera-labs',
      partner: 'Astera Labs',
      category: 'interconnect',
      purpose: 'NVLink Fusion ecosystem partner',
      evidence_quote: 'Astera Labs joins NVLink Fusion',
      evidence_url: 'https://blogs.nvidia.com/x',
      evidence_history: [],
      first_announced: '2026-04-22',
      last_confirmed: '2026-04-22',
      status: 'active',
      confidence: 'high',
      notes: '',
      proposed_from_article: 'https://blogs.nvidia.com/x'
    };
    expect(() => PendingProposalSchema.parse(valid)).not.toThrow();
  });

  it('rejects without proposed_from_article', () => {
    const invalid = { id: 'x', partner: 'X' };
    expect(() => PendingProposalSchema.parse(invalid)).toThrow();
  });
});

describe('ArticleSchema', () => {
  it('accepts a valid article', () => {
    const valid = {
      id: 'a'.repeat(64),
      url: 'https://example.com/x',
      title: 'Some headline',
      published_at: '2026-04-27',
      source: 'nvidia-newsroom',
      body_text: 'The article body...'
    };
    expect(() => ArticleSchema.parse(valid)).not.toThrow();
  });

  it('rejects a short id (must be sha256 hex)', () => {
    const invalid = {
      id: 'short',
      url: 'https://x.com',
      title: 'x',
      published_at: '2026-04-27',
      source: 'x',
      body_text: 'x'
    };
    expect(() => ArticleSchema.parse(invalid)).toThrow();
  });
});

describe('RawFileSchema', () => {
  it('accepts a valid raw file with multiple articles', () => {
    const valid = {
      fetched_at: '2026-04-28T11:00:00Z',
      articles: [
        {
          id: 'a'.repeat(64),
          url: 'https://x.com/1',
          title: 'one',
          published_at: '2026-04-27',
          source: 'rss-x',
          body_text: 'body 1'
        }
      ]
    };
    expect(() => RawFileSchema.parse(valid)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
npm test -- tests/schema.test.ts
```

Expected: failures with "PendingProposalSchema is not exported" or similar.

- [ ] **Step 3: Add schemas to src/lib/schema.ts**

Append to `src/lib/schema.ts`:

```typescript
export const PendingProposalSchema = RelationshipSchema.extend({
  proposed_from_article: z.string().url()
});
export type PendingProposal = z.infer<typeof PendingProposalSchema>;

export const ArticleSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/, 'id must be sha256 hex'),
  url: z.string().url(),
  title: z.string().min(1),
  published_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().min(1),
  body_text: z.string()
});
export type Article = z.infer<typeof ArticleSchema>;

export const RawFileSchema = z.object({
  fetched_at: z.string().datetime(),
  articles: z.array(ArticleSchema)
});
export type RawFile = z.infer<typeof RawFileSchema>;
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
npm test -- tests/schema.test.ts
```

Expected: all schema tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts tests/schema.test.ts
git commit -m "feat: add PendingProposal, Article, and RawFile schemas"
```

---

### Task 9: Create data loader utility

**Files:**
- Create: `src/lib/data.ts`
- Test: `tests/data.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/data.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { loadRelationships, loadPending } from '../src/lib/data';

describe('loadRelationships', () => {
  it('loads and validates the relationships file', () => {
    const result = loadRelationships();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('loadPending', () => {
  it('loads and validates the pending file', () => {
    const result = loadPending();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
npm test -- tests/data.test.ts
```

Expected: error "Cannot find module '../src/lib/data'"

- [ ] **Step 3: Implement loader**

Create `src/lib/data.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { RelationshipSchema, PendingProposalSchema, type Relationship, type PendingProposal } from './schema';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

export function loadRelationships(): Relationship[] {
  const raw = readFileSync(resolve(REPO_ROOT, 'data/relationships.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  return z.array(RelationshipSchema).parse(parsed);
}

export function loadPending(): PendingProposal[] {
  const raw = readFileSync(resolve(REPO_ROOT, 'data/pending.json'), 'utf-8');
  const parsed = JSON.parse(raw);
  return z.array(PendingProposalSchema).parse(parsed);
}
```

- [ ] **Step 4: Run test, verify it passes**

```bash
npm test -- tests/data.test.ts
```

Expected: 2 passed (the empty arrays in `data/*.json` are valid).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data.ts tests/data.test.ts
git commit -m "feat: add data loader with schema validation"
```

---

### Task 10: Build-time validation script

**Files:**
- Create: `scripts/validate-data.ts`

- [ ] **Step 1: Create validation script**

```typescript
// scripts/validate-data.ts
import { loadRelationships, loadPending } from '../src/lib/data';

try {
  const rels = loadRelationships();
  const pending = loadPending();
  console.log(`✓ relationships.json valid (${rels.length} entries)`);
  console.log(`✓ pending.json valid (${pending.length} entries)`);
  process.exit(0);
} catch (err) {
  console.error('✗ Data validation failed:');
  console.error(err);
  process.exit(1);
}
```

- [ ] **Step 2: Run it**

```bash
npm run validate-data
```

Expected:
```
✓ relationships.json valid (0 entries)
✓ pending.json valid (0 entries)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-data.ts
git commit -m "feat: add build-time data validation script"
```

---

## Phase 3 — Collection script

### Task 11: Define source list

**Files:**
- Create: `scripts/sources.ts`

- [ ] **Step 1: Create sources file**

```typescript
// scripts/sources.ts

export type Source =
  | { type: 'rss';    name: string; url: string }
  | { type: 'scrape'; name: string; url: string };

export const sources: Source[] = [
  { type: 'rss',    name: 'nvidia-blog',     url: 'https://blogs.nvidia.com/feed/' },
  { type: 'scrape', name: 'nvidia-newsroom', url: 'https://nvidianews.nvidia.com/news' },
  { type: 'rss',    name: 'semianalysis',    url: 'https://semianalysis.com/feed/' },
  { type: 'rss',    name: 'reuters-tech',    url: 'https://www.reutersagency.com/feed/?best-sectors=tech' },
  { type: 'rss',    name: 'ieee-spectrum',   url: 'https://spectrum.ieee.org/feeds/feed.rss' },
  { type: 'rss',    name: 'anandtech',       url: 'https://www.anandtech.com/rss/' }
];

// Keywords used for relevance filtering — articles must mention at least one.
export const RELEVANCE_KEYWORDS = [
  'nvidia',
  'cuda',
  'nvlink',
  'blackwell',
  'hopper',
  'grace',
  'rubin',
  'dgx',
  'spectrum-x'
];
```

- [ ] **Step 2: Verify it parses**

```bash
npx tsx scripts/sources.ts
```

Expected: no output, no errors (the file just exports, it doesn't run anything).

- [ ] **Step 3: Commit**

```bash
git add scripts/sources.ts
git commit -m "feat: add RSS feed and scrape target list"
```

---

### Task 12: URL hash function (TDD)

**Files:**
- Create: `scripts/lib/hash.ts`
- Test: `tests/hash.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/hash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hashUrl } from '../scripts/lib/hash';

describe('hashUrl', () => {
  it('returns a 64-char hex string', () => {
    const hash = hashUrl('https://example.com/article');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is stable for the same input', () => {
    const a = hashUrl('https://example.com/article');
    const b = hashUrl('https://example.com/article');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', () => {
    const a = hashUrl('https://example.com/article');
    const b = hashUrl('https://example.com/different');
    expect(a).not.toBe(b);
  });

  it('normalizes URL by lowercasing and stripping trailing slash', () => {
    const a = hashUrl('https://Example.com/Article');
    const b = hashUrl('https://example.com/article/');
    const c = hashUrl('https://example.com/article');
    expect(a).toBe(c);
    expect(b).toBe(c);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/hash.test.ts
```

Expected: error "Cannot find module '../scripts/lib/hash'".

- [ ] **Step 3: Implement hash**

Create `scripts/lib/hash.ts`:

```typescript
import { createHash } from 'node:crypto';

export function hashUrl(url: string): string {
  const normalized = url.toLowerCase().replace(/\/$/, '');
  return createHash('sha256').update(normalized).digest('hex');
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/hash.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/hash.ts tests/hash.test.ts
git commit -m "feat: add stable URL hashing for article dedup"
```

---

### Task 13: Relevance filter (TDD)

**Files:**
- Create: `scripts/lib/relevance.ts`
- Test: `tests/relevance.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/relevance.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isRelevant } from '../scripts/lib/relevance';

describe('isRelevant', () => {
  it('keeps articles that mention Nvidia', () => {
    expect(isRelevant({ title: 'Nvidia announces new chip', body_text: '...' })).toBe(true);
  });

  it('keeps articles that mention NVLink', () => {
    expect(isRelevant({ title: 'New NVLink fabric standard', body_text: '...' })).toBe(true);
  });

  it('checks first 500 chars of body if title is unrelated', () => {
    expect(isRelevant({
      title: 'Big tech news',
      body_text: 'Some preamble. Nvidia and AMD reported earnings today...'
    })).toBe(true);
  });

  it('rejects articles without any keyword', () => {
    expect(isRelevant({ title: 'AMD launches new product', body_text: 'Intel is doing things' })).toBe(false);
  });

  it('is case insensitive', () => {
    expect(isRelevant({ title: 'NVIDIA news', body_text: '' })).toBe(true);
    expect(isRelevant({ title: 'nvidia news', body_text: '' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/relevance.test.ts
```

Expected: error "Cannot find module".

- [ ] **Step 3: Implement filter**

Create `scripts/lib/relevance.ts`:

```typescript
import { RELEVANCE_KEYWORDS } from '../sources';

export interface RelevanceInput {
  title: string;
  body_text: string;
}

export function isRelevant(article: RelevanceInput): boolean {
  const haystack = (article.title + ' ' + article.body_text.slice(0, 500)).toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => haystack.includes(kw));
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/relevance.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/relevance.ts tests/relevance.test.ts
git commit -m "feat: add Nvidia keyword relevance filter"
```

---

### Task 14: RSS parser wrapper

**Files:**
- Create: `scripts/lib/fetch-rss.ts`
- Test: `tests/fetch-rss.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/fetch-rss.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { parseRssXml } from '../scripts/lib/fetch-rss';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Nvidia and TSMC announce</title>
      <link>https://example.com/article-1</link>
      <pubDate>Mon, 27 Apr 2026 12:00:00 GMT</pubDate>
      <description>Some body text about the partnership.</description>
    </item>
    <item>
      <title>Second article</title>
      <link>https://example.com/article-2</link>
      <pubDate>Sun, 26 Apr 2026 12:00:00 GMT</pubDate>
      <description>Another body.</description>
    </item>
  </channel>
</rss>`;

describe('parseRssXml', () => {
  it('parses items with link, title, date, body', async () => {
    const items = await parseRssXml(SAMPLE_RSS);
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe('https://example.com/article-1');
    expect(items[0].title).toBe('Nvidia and TSMC announce');
    expect(items[0].published_at).toBe('2026-04-27');
    expect(items[0].body_text).toContain('partnership');
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/fetch-rss.test.ts
```

Expected: error "Cannot find module".

- [ ] **Step 3: Implement parser**

Create `scripts/lib/fetch-rss.ts`:

```typescript
import RssParser from 'rss-parser';

export interface RssItem {
  url: string;
  title: string;
  published_at: string;  // YYYY-MM-DD
  body_text: string;
}

const parser = new RssParser();

export async function parseRssXml(xml: string): Promise<RssItem[]> {
  const feed = await parser.parseString(xml);
  return (feed.items ?? [])
    .filter((it) => it.link && it.title)
    .map((it) => ({
      url: it.link!,
      title: it.title!,
      published_at: toIsoDate(it.isoDate ?? it.pubDate ?? new Date().toISOString()),
      body_text: stripHtml(it.contentSnippet ?? it.content ?? it.summary ?? '')
    }));
}

export async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'nvidia-tracker (seanfkelley1@gmail.com)' }
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status} ${url}`);
  const xml = await res.text();
  return parseRssXml(xml);
}

function toIsoDate(input: string): string {
  const d = new Date(input);
  return d.toISOString().slice(0, 10);
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/fetch-rss.test.ts
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/fetch-rss.ts tests/fetch-rss.test.ts
git commit -m "feat: add RSS feed parser"
```

---

### Task 15: Nvidia newsroom scraper

**Files:**
- Create: `scripts/lib/fetch-newsroom.ts`
- Create: `tests/fixtures/newsroom-sample.html`
- Test: `tests/fetch-newsroom.test.ts`

- [ ] **Step 1: Save a sample HTML fixture**

Open `https://nvidianews.nvidia.com/news` in a browser, view source, save as `tests/fixtures/newsroom-sample.html`. (If the structure differs from the assumed selectors below, the test will tell you and you'll adjust.)

For the plan, you can also use this minimal stand-in fixture if the site is unreachable:

`tests/fixtures/newsroom-sample.html`:
```html
<!DOCTYPE html>
<html><body>
<div class="newsroom-list">
  <article class="news-item">
    <h2><a href="/news/sample-article-1">Nvidia announces new partnership with TSMC</a></h2>
    <time datetime="2026-04-27">April 27, 2026</time>
    <p class="excerpt">A summary of the partnership announcement.</p>
  </article>
  <article class="news-item">
    <h2><a href="/news/sample-article-2">Quarterly earnings report</a></h2>
    <time datetime="2026-04-25">April 25, 2026</time>
    <p class="excerpt">Earnings discussion.</p>
  </article>
</div>
</body></html>
```

- [ ] **Step 2: Write failing test**

Create `tests/fetch-newsroom.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseNewsroomHtml } from '../scripts/lib/fetch-newsroom';

const SAMPLE = readFileSync('tests/fixtures/newsroom-sample.html', 'utf-8');

describe('parseNewsroomHtml', () => {
  it('extracts article title, URL, and date', () => {
    const items = parseNewsroomHtml(SAMPLE, 'https://nvidianews.nvidia.com');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toContain('TSMC');
    expect(items[0].url).toBe('https://nvidianews.nvidia.com/news/sample-article-1');
    expect(items[0].published_at).toBe('2026-04-27');
  });
});
```

- [ ] **Step 3: Run test, verify failure**

```bash
npm test -- tests/fetch-newsroom.test.ts
```

Expected: error "Cannot find module".

- [ ] **Step 4: Implement scraper**

Create `scripts/lib/fetch-newsroom.ts`:

```typescript
import * as cheerio from 'cheerio';
import type { RssItem } from './fetch-rss';

export function parseNewsroomHtml(html: string, baseUrl: string): RssItem[] {
  const $ = cheerio.load(html);
  const items: RssItem[] = [];

  $('article.news-item').each((_, el) => {
    const link = $(el).find('h2 a').first();
    const href = link.attr('href');
    const title = link.text().trim();
    const dateAttr = $(el).find('time').attr('datetime');
    const body = $(el).find('.excerpt').text().trim();

    if (!href || !title || !dateAttr) return;

    const url = href.startsWith('http') ? href : new URL(href, baseUrl).toString();
    items.push({
      url,
      title,
      published_at: dateAttr.slice(0, 10),
      body_text: body
    });
  });

  return items;
}

export async function fetchNewsroom(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'nvidia-tracker (seanfkelley1@gmail.com)' }
  });
  if (!res.ok) throw new Error(`Newsroom fetch failed: ${res.status}`);
  const html = await res.text();
  return parseNewsroomHtml(html, url);
}
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm test -- tests/fetch-newsroom.test.ts
```

Expected: 1 passed.

If the test fails because the real Nvidia newsroom uses different HTML selectors, update the selectors in `parseNewsroomHtml` to match what you see in the actual saved HTML, and adjust the test fixture to mirror that.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/fetch-newsroom.ts tests/fetch-newsroom.test.ts tests/fixtures/newsroom-sample.html
git commit -m "feat: add Nvidia newsroom HTML scraper"
```

---

### Task 16: Dedup function (TDD)

**Files:**
- Create: `scripts/lib/dedup.ts`
- Test: `tests/dedup.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/dedup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { collectExistingIds } from '../scripts/lib/dedup';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('collectExistingIds', () => {
  it('reads all article ids from raw/*.json files', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dedup-'));
    mkdirSync(join(tmp, 'raw'));

    writeFileSync(join(tmp, 'raw/2026-04-27.json'), JSON.stringify({
      fetched_at: '2026-04-27T11:00:00Z',
      articles: [{ id: 'a'.repeat(64), url: 'https://example.com/1', title: 't', published_at: '2026-04-27', source: 's', body_text: 'b' }]
    }));
    writeFileSync(join(tmp, 'raw/2026-04-28.json'), JSON.stringify({
      fetched_at: '2026-04-28T11:00:00Z',
      articles: [{ id: 'b'.repeat(64), url: 'https://example.com/2', title: 't2', published_at: '2026-04-28', source: 's', body_text: 'b' }]
    }));

    const ids = collectExistingIds(join(tmp, 'raw'));
    expect(ids.has('a'.repeat(64))).toBe(true);
    expect(ids.has('b'.repeat(64))).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('returns empty set when raw/ has no JSON files', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dedup-'));
    mkdirSync(join(tmp, 'raw'));
    const ids = collectExistingIds(join(tmp, 'raw'));
    expect(ids.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/dedup.test.ts
```

Expected: error "Cannot find module".

- [ ] **Step 3: Implement dedup**

Create `scripts/lib/dedup.ts`:

```typescript
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RawFileSchema } from '../../src/lib/schema';

export function collectExistingIds(rawDir: string): Set<string> {
  const ids = new Set<string>();
  const files = readdirSync(rawDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const raw = readFileSync(join(rawDir, file), 'utf-8');
    const parsed = RawFileSchema.parse(JSON.parse(raw));
    for (const article of parsed.articles) {
      ids.add(article.id);
    }
  }

  return ids;
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/dedup.test.ts
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/dedup.ts tests/dedup.test.ts
git commit -m "feat: add article dedup based on raw/ scan"
```

---

### Task 17: Wire collect.ts together

**Files:**
- Create: `scripts/collect.ts`

- [ ] **Step 1: Implement the orchestrator**

Create `scripts/collect.ts`:

```typescript
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sources } from './sources';
import { fetchRss } from './lib/fetch-rss';
import { fetchNewsroom } from './lib/fetch-newsroom';
import { hashUrl } from './lib/hash';
import { isRelevant } from './lib/relevance';
import { collectExistingIds } from './lib/dedup';
import { RawFileSchema, type Article } from '../src/lib/schema';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const RAW_DIR = resolve(REPO_ROOT, 'raw');
const POLITE_DELAY_MS = 2000;

async function main() {
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR);

  const existingIds = collectExistingIds(RAW_DIR);
  console.log(`Existing article IDs: ${existingIds.size}`);

  const newArticles: Article[] = [];

  for (const source of sources) {
    try {
      console.log(`Fetching ${source.name}...`);
      const items = source.type === 'rss'
        ? await fetchRss(source.url)
        : await fetchNewsroom(source.url);

      for (const item of items) {
        const id = hashUrl(item.url);
        if (existingIds.has(id)) continue;
        if (!isRelevant({ title: item.title, body_text: item.body_text })) continue;
        newArticles.push({
          id,
          url: item.url,
          title: item.title,
          published_at: item.published_at,
          source: source.name,
          body_text: item.body_text
        });
        existingIds.add(id);
      }
      await sleep(POLITE_DELAY_MS);
    } catch (err) {
      console.error(`✗ ${source.name} failed:`, (err as Error).message);
    }
  }

  if (newArticles.length === 0) {
    console.log('No new articles. Nothing to write.');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const outFile = resolve(RAW_DIR, `${today}.json`);

  let payload;
  if (existsSync(outFile)) {
    const existing = RawFileSchema.parse(JSON.parse(readFileSync(outFile, 'utf-8')));
    payload = {
      fetched_at: new Date().toISOString(),
      articles: [...existing.articles, ...newArticles]
    };
  } else {
    payload = { fetched_at: new Date().toISOString(), articles: newArticles };
  }

  RawFileSchema.parse(payload);  // self-check
  writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n');
  console.log(`✓ Wrote ${newArticles.length} new articles to ${outFile}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it locally**

```bash
npm run collect
```

Expected: console output showing each source being fetched. Some sources may fail (network, rate limits) — that's OK as long as the script completes. A new file appears in `raw/` if at least one article passed the relevance filter.

If you see no new articles, that's also OK — it means everything found was either irrelevant or already collected.

- [ ] **Step 3: Verify the output validates**

```bash
ls raw/
npm run validate-data
```

Expected: a `raw/YYYY-MM-DD.json` file exists, validation still passes (validate-data only validates `data/*.json` for now, but raw is parsed as it's read).

- [ ] **Step 4: Commit**

```bash
git add scripts/collect.ts raw/
git commit -m "feat: implement daily collection pipeline"
```

---

## Phase 4 — GitHub Action: daily collection

### Task 18: Create collect.yml workflow

**Files:**
- Create: `.github/workflows/collect.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/collect.yml
name: Daily collection
on:
  schedule:
    - cron: '0 11 * * *'  # 6am ET (11:00 UTC during DST; 12:00 UTC otherwise)
  workflow_dispatch:

permissions:
  contents: write

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run collect
      - name: Commit changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add raw/
          if git diff --staged --quiet; then
            echo "No new articles to commit."
          else
            git commit -m "chore: daily collection $(date -u +%Y-%m-%d)"
            git push
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/collect.yml
git commit -m "chore: add daily collection GitHub Action"
```

- [ ] **Step 3: After pushing to GitHub, manually trigger to test**

After the repo is on GitHub (Task 32), trigger the workflow manually via the Actions tab to confirm it runs end-to-end.

---

## Phase 5 — Email reminder

### Task 19: Days-since calculation (TDD)

**Files:**
- Create: `scripts/lib/extraction-status.ts`
- Test: `tests/extraction-status.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/extraction-status.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { daysSince, parseExtractionDate } from '../scripts/lib/extraction-status';

describe('parseExtractionDate', () => {
  it('parses "Week of YYYY-MM-DD" from a commit message', () => {
    expect(parseExtractionDate('Week of 2026-04-21: 3 updates')).toEqual(new Date('2026-04-21'));
  });

  it('returns null when no extraction marker', () => {
    expect(parseExtractionDate('chore: daily collection 2026-04-28')).toBe(null);
  });
});

describe('daysSince', () => {
  it('returns rounded day count', () => {
    const past = new Date('2026-04-21T00:00:00Z');
    const now = new Date('2026-04-28T00:00:00Z');
    expect(daysSince(past, now)).toBe(7);
  });

  it('returns 0 if same day', () => {
    const d = new Date('2026-04-28T00:00:00Z');
    expect(daysSince(d, d)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npm test -- tests/extraction-status.test.ts
```

Expected: error "Cannot find module".

- [ ] **Step 3: Implement**

Create `scripts/lib/extraction-status.ts`:

```typescript
export function parseExtractionDate(commitMessage: string): Date | null {
  const m = commitMessage.match(/Week of (\d{4}-\d{2}-\d{2})/);
  return m ? new Date(m[1]) : null;
}

export function daysSince(then: Date, now: Date = new Date()): number {
  const ms = now.getTime() - then.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npm test -- tests/extraction-status.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/extraction-status.ts tests/extraction-status.test.ts
git commit -m "feat: add extraction date parsing and days-since helpers"
```

---

### Task 20: Build the reminder script

**Files:**
- Create: `scripts/send-reminder.ts`

- [ ] **Step 1: Implement the reminder script**

```typescript
// scripts/send-reminder.ts
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resend } from 'resend';
import { parseExtractionDate, daysSince } from './lib/extraction-status';
import { RawFileSchema } from '../src/lib/schema';
import { loadPending } from '../src/lib/data';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const RAW_DIR = resolve(REPO_ROOT, 'raw');

function findLastExtraction(): Date | null {
  const log = execSync('git log --pretty=%s -n 200', { cwd: REPO_ROOT }).toString();
  for (const line of log.split('\n')) {
    const date = parseExtractionDate(line);
    if (date) return date;
  }
  return null;
}

function countNewArticlesSince(since: Date | null): number {
  let count = 0;
  for (const file of readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'))) {
    const raw = readFileSync(resolve(RAW_DIR, file), 'utf-8');
    const parsed = RawFileSchema.parse(JSON.parse(raw));
    if (since && new Date(parsed.fetched_at) <= since) continue;
    count += parsed.articles.length;
  }
  return count;
}

function buildEmailBody(daysSinceLast: number | null, newArticles: number, pendingCount: number): string {
  const stale = daysSinceLast === null
    ? "You haven't run an extraction yet."
    : `It's been ${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'} since your last extraction.`;

  return [
    stale,
    `New articles: ${newArticles}`,
    `Pending review queue: ${pendingCount}`,
    '',
    'Open Claude Code in the project folder and run /extract when you\'re ready.'
  ].join('\n');
}

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

  const body = buildEmailBody(days, newCount, pending);
  const subject = `NVIDIA Tracker — ${newCount} articles ready for review`;

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Note: `onboarding@resend.dev` works without domain verification on the free tier. Once you verify a custom domain, change the `from` address.

- [ ] **Step 2: Test the body builder logic indirectly**

You can run the script locally without a Resend key — it'll just print the body and exit cleanly:

```bash
npm run remind
```

Expected: console shows the email body with "RESEND_API_KEY or EMAIL_TO not set" warning. No email sent.

- [ ] **Step 3: Commit**

```bash
git add scripts/send-reminder.ts
git commit -m "feat: implement Sunday email reminder script"
```

---

### Task 21: Create reminder.yml workflow

**Files:**
- Create: `.github/workflows/reminder.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/reminder.yml
name: Sunday reminder
on:
  schedule:
    - cron: '0 14 * * 0'  # 9am ET Sunday (14:00 UTC during DST)
  workflow_dispatch:

permissions:
  contents: read

jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 200  # need history for parseExtractionDate
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run remind
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_TO: ${{ secrets.EMAIL_TO }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/reminder.yml
git commit -m "chore: add Sunday reminder GitHub Action"
```

---

## Phase 6 — /extract slash command

### Task 22: Create the /extract slash command

**Files:**
- Create: `.claude/commands/extract.md`

- [ ] **Step 1: Write the slash command**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add .claude/commands/extract.md
git commit -m "feat: add /extract slash command for weekly extraction"
```

---

## Phase 7 — Astro placeholder page

### Task 23: Create placeholder home page

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Write minimal placeholder**

```astro
---
// src/pages/index.astro
import { loadRelationships } from '~/lib/data';

const relationships = loadRelationships();
const activeCount = relationships.filter((r) => r.status === 'active').length;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Nvidia Ecosystem Tracker</title>
    <style>
      body { font-family: Georgia, serif; background: #f3ede0; color: #1a1612; margin: 0; padding: 4rem 2rem; }
      .wrap { max-width: 640px; margin: 0 auto; text-align: center; }
      h1 { font-style: italic; font-weight: 400; font-size: 2rem; margin-bottom: 0.5rem; }
      p { color: #6b5d45; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Nvidia Ecosystem</h1>
      <p>{activeCount} active partnerships tracked.</p>
      <p style="margin-top: 2rem; font-size: 0.9rem;">Dashboard under construction. Plan B: full graph view.</p>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Test the build**

```bash
npm run build
```

Expected: `dist/` directory is created. No errors. The build should validate the data files via the import.

- [ ] **Step 3: Test the dev server**

```bash
npm run dev
```

Expected: server starts at `http://localhost:4321`. Open it in a browser, see the placeholder page with "0 active partnerships tracked."

Stop the server with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add placeholder home page"
```

---

### Task 24: Test Cloudflare Workers preview

**Files:** (no new files)

- [ ] **Step 1: Build and preview locally with Wrangler**

```bash
npm run preview
```

Expected: Wrangler starts a local Workers runtime serving `dist/`. Output includes a URL like `http://localhost:8787`. Open it in a browser, verify the same placeholder page renders.

Stop with Ctrl+C.

- [ ] **Step 2: No commit needed (no file changes)**

This is just a verification step.

---

## Phase 8 — Documentation & deployment

### Task 25: Write README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and workflow instructions"
```

---

### Task 26: First deploy to Cloudflare Workers

**Files:** (no new files; this is a deploy step)

- [ ] **Step 1: Push the repo to GitHub**

```bash
gh repo create nvidia-tracker --private --source . --remote origin --push
```

If you don't have `gh` CLI, manually create the repo on github.com and:

```bash
git remote add origin git@github.com:<your-username>/nvidia-tracker.git
git push -u origin main
```

- [ ] **Step 2: First deploy to Cloudflare Workers**

```bash
npm run deploy
```

Expected: Wrangler asks you to confirm the project name, then deploys. Output shows a `*.workers.dev` URL. Visit it in a browser, verify the placeholder page loads.

- [ ] **Step 3: Update astro.config.mjs with the real URL**

Edit `astro.config.mjs`:
```javascript
site: 'https://nvidia-tracker.<your-subdomain>.workers.dev',
```

(Replace `<your-subdomain>` with your actual subdomain.)

```bash
git add astro.config.mjs
git commit -m "chore: update site URL to deployed Cloudflare Workers address"
git push
```

- [ ] **Step 4: Set up GitHub secrets**

In GitHub repo Settings → Secrets and variables → Actions, add:
- `RESEND_API_KEY` (create a free Resend account at resend.com, copy API key)
- `EMAIL_TO` (your email address)

- [ ] **Step 5: Manually trigger the daily collection workflow**

In GitHub repo Actions tab → "Daily collection" → Run workflow.

Expected: workflow completes within ~2 minutes. If new articles were found, a commit appears on `main` like `chore: daily collection 2026-04-28`. The Action output shows which sources succeeded vs. failed.

- [ ] **Step 6: Manually trigger the Sunday reminder**

Same flow with "Sunday reminder". Expected: an email arrives at `EMAIL_TO` with the article counts.

- [ ] **Step 7: Done.**

Plan A is complete. The data layer is live and the pipelines work. Next: the initial seed pass (open Claude Code, ask Claude to do the seed research). Then Plan B (the dashboard).

---

## Self-review checklist (already performed by writing-plans skill)

- ✅ All schemas defined and tested before being used downstream
- ✅ All collection sub-functions defined and tested before being orchestrated in `collect.ts`
- ✅ Function names consistent across tasks: `hashUrl`, `isRelevant`, `parseRssXml`/`fetchRss`, `parseNewsroomHtml`/`fetchNewsroom`, `collectExistingIds`, `parseExtractionDate`/`daysSince`, `buildEmailBody`
- ✅ Type names consistent: `Source`, `RssItem`, `Article`, `RawFile`, `Relationship`, `PendingProposal`
- ✅ Data validation runs at three points: on collection write (`RawFileSchema.parse`), on `npm run validate-data`, and on every Astro build (via `loadRelationships()` import)
- ✅ The `Week of YYYY-MM-DD` commit format is enforced in the `/extract` command and parsed in `parseExtractionDate` — these match
- ✅ No placeholder text — every step contains actual code or commands

## Open items for Plan B (not in scope here)

- Cytoscape.js integration and graph rendering
- Editorial styling (cream paper, ink colors, transparent logos)
- `/list`, `/partners/[id]`, `/about` routes
- Logo sourcing for ~30 seed partners
- Mobile fallback wiring
- Force-directed layout tuning
- Hover/click/idle motion behaviors

---
