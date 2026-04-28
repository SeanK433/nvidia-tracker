import { describe, it, expect } from 'vitest';
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
