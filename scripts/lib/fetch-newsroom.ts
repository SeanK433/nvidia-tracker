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
