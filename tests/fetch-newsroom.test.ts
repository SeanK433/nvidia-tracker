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
