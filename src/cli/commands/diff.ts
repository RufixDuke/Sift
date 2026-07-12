import { Persistence } from '../../core/persistence.js';
import type { SessionRow } from '../../core/persistence.js';

export interface DiffOptions {
  stripAnsi?: boolean;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

function pad(s: string | number, width: number): string {
  return String(s).padEnd(width, ' ');
}

function summarize(
  label: string,
  session: SessionRow,
  levelCounts: Record<string, number>,
  serviceCounts: Record<string, number>,
): string {
  const lines: string[] = [];
  lines.push(`${label}: ${session.name}`);
  lines.push(`  id:          ${session.id}`);
  lines.push(`  started:     ${formatDate(session.createdAt)}`);
  lines.push(`  logs:        ${session.logCount}`);
  lines.push(`  services:    ${session.serviceCount ?? Object.keys(serviceCounts).length}`);
  lines.push(`  command:     ${session.command ?? 'n/a'}`);
  lines.push('  levels:');
  for (const level of ['error', 'warn', 'info', 'debug', 'trace', 'unknown']) {
    lines.push(`    ${pad(level, 8)} ${levelCounts[level] ?? 0}`);
  }
  lines.push('  services:');
  for (const [service, count] of Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`    ${pad(service, 12)} ${count}`);
  }
  return lines.join('\n');
}

export async function diffCommand(
  sessionA: string,
  sessionB: string,
  _options: DiffOptions = {},
): Promise<void> {
  const persistence = new Persistence();

  if (!persistence.isAvailable()) {
    console.error('SQLite persistence is unavailable. Install build tools to use sift diff.');
    const reason = persistence.getUnavailableReason();
    if (reason) console.error(reason);
    process.exit(1);
  }

  const a = persistence.findSession(sessionA);
  const b = persistence.findSession(sessionB);

  if (!a) {
    console.error(`No session found for "${sessionA}".`);
    persistence.close();
    process.exit(1);
  }
  if (!b) {
    console.error(`No session found for "${sessionB}".`);
    persistence.close();
    process.exit(1);
  }

  const summaryA = persistence.summarizeSession(a.id);
  const summaryB = persistence.summarizeSession(b.id);

  persistence.close();

  console.log(summarize('A', a, summaryA.levelCounts, summaryA.serviceCounts));
  console.log('');
  console.log(summarize('B', b, summaryB.levelCounts, summaryB.serviceCounts));
  console.log('');

  const allLevels = new Set([
    ...Object.keys(summaryA.levelCounts),
    ...Object.keys(summaryB.levelCounts),
  ]);
  const allServices = new Set([
    ...Object.keys(summaryA.serviceCounts),
    ...Object.keys(summaryB.serviceCounts),
  ]);

  console.log('Diff summary');
  console.log(`  ${pad('metric', 14)} ${pad('A', 10)} ${pad('B', 10)} ${pad('Δ', 10)}`);
  console.log(`  ${pad('total logs', 14)} ${pad(a.logCount, 10)} ${pad(b.logCount, 10)} ${pad(b.logCount - a.logCount, 10)}`);

  for (const level of Array.from(allLevels).sort()) {
    const ca = summaryA.levelCounts[level] ?? 0;
    const cb = summaryB.levelCounts[level] ?? 0;
    console.log(`  ${pad(level + ' logs', 14)} ${pad(ca, 10)} ${pad(cb, 10)} ${pad(cb - ca, 10)}`);
  }

  console.log('');
  console.log('Services diff');
  console.log(`  ${pad('service', 14)} ${pad('A', 10)} ${pad('B', 10)} ${pad('Δ', 10)}`);
  for (const service of Array.from(allServices).sort()) {
    const ca = summaryA.serviceCounts[service] ?? 0;
    const cb = summaryB.serviceCounts[service] ?? 0;
    console.log(`  ${pad(service, 14)} ${pad(ca, 10)} ${pad(cb, 10)} ${pad(cb - ca, 10)}`);
  }
}
