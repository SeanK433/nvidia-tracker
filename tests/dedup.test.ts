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
