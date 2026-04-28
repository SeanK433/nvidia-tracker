import { RELEVANCE_KEYWORDS } from '../sources';

export interface RelevanceInput {
  title: string;
  body_text: string;
}

export function isRelevant(article: RelevanceInput): boolean {
  const haystack = (article.title + ' ' + article.body_text.slice(0, 500)).toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => haystack.includes(kw));
}
