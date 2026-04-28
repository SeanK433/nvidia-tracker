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
