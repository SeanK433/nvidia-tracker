// scripts/send-reminder.ts
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resend } from 'resend';
import { parseExtractionDate, daysSince, countPartnersNeedingSignificanceReview } from './lib/extraction-status';
import { RawFileSchema } from '../src/lib/schema';
import { loadPending, loadRelationships } from '../src/lib/data';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const RAW_DIR = resolve(REPO_ROOT, 'raw');

function findLastExtraction(): Date | null {
  const log = execSync('git log --pretty=%s -n 200', { cwd: REPO_ROOT }).toString();
  for (const line of log.split('\n')) {
    const date = parseExtractionDate(line);
    if (date) return date;
  }
  return null;
}

function countNewArticlesSince(since: Date | null): number {
  let count = 0;
  for (const file of readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'))) {
    const raw = readFileSync(resolve(RAW_DIR, file), 'utf-8');
    const parsed = RawFileSchema.parse(JSON.parse(raw));
    if (since && new Date(parsed.fetched_at) <= since) continue;
    count += parsed.articles.length;
  }
  return count;
}

function buildEmailBody(
  daysSinceLast: number | null,
  newArticles: number,
  pendingCount: number,
  partnersNeedingReview: number
): string {
  const stale = daysSinceLast === null
    ? "You haven't run an extraction yet."
    : `It's been ${daysSinceLast} day${daysSinceLast === 1 ? '' : 's'} since your last extraction.`;

  const lines = [
    'Sunday maintenance — NVIDIA Tracker',
    '',
    stale,
    '',
    `/extract:               ${newArticles} new article${newArticles === 1 ? '' : 's'} since last extraction`,
    `/review-significance:    ${partnersNeedingReview} partner${partnersNeedingReview === 1 ? '' : 's'} with new milestones since last review`,
  ];

  if (pendingCount > 0) {
    lines.push(`Pending review queue:    ${pendingCount}`);
  }

  lines.push('', 'Open Claude Code in the project folder and run /extract and /review-significance when ready.');
  return lines.join('\n');
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.EMAIL_TO;

  if (!apiKey || !to) {
    console.warn('RESEND_API_KEY or EMAIL_TO not set — exiting cleanly without sending.');
    return;
  }

  const last = findLastExtraction();
  const days = last ? daysSince(last) : null;
  const newCount = countNewArticlesSince(last);
  const pending = loadPending().length;
  const needReview = countPartnersNeedingSignificanceReview(loadRelationships());

  // Short-circuit: nothing to do, no email.
  if (newCount === 0 && needReview === 0 && pending === 0) {
    console.log('No maintenance work pending — skipping email.');
    return;
  }

  const body = buildEmailBody(days, newCount, pending, needReview);
  const subject = `NVIDIA Tracker — ${newCount} articles + ${needReview} partners ready for review`;

  console.log('Email body:\n' + body);

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: 'NVIDIA Tracker <onboarding@resend.dev>',
    to,
    subject,
    text: body
  });

  if (error) {
    console.error('✗ Resend error:', error);
    process.exit(1);
  }
  console.log('✓ Reminder sent');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
