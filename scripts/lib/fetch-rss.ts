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
