import { createHash } from 'node:crypto';

export function hashUrl(url: string): string {
  const normalized = url.toLowerCase().replace(/\/$/, '');
  return createHash('sha256').update(normalized).digest('hex');
}
