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
