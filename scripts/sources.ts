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
