export function parseExtractionDate(commitMessage: string): Date | null {
  const m = commitMessage.match(/Week of (\d{4}-\d{2}-\d{2})/);
  return m ? new Date(m[1]) : null;
}

export function daysSince(then: Date, now: Date = new Date()): number {
  const ms = now.getTime() - then.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}
