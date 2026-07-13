import { describe, it, expect } from 'vitest';
import { parseLogLine } from '../src/core/parser.js';
import { LogBuffer } from '../src/core/buffer.js';

describe('performance', () => {
  it('ingests 10,000 lines in under 2 seconds', () => {
    const count = 10_000;
    const lines: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const level = i % 100 === 0 ? 'ERROR' : i % 50 === 0 ? 'WARN' : 'INFO';
      lines.push(`2026-01-15T09:32:15.123Z [${level}] request ${i} completed`);
    }

    const start = performance.now();
    for (const line of lines) {
      parseLogLine(line, { service: 'api', stream: 'stdout' });
    }
    const elapsed = performance.now() - start;

    const throughput = count / (elapsed / 1000);
    console.log(`Ingestion throughput: ${throughput.toFixed(0)} lines/sec`);
    expect(throughput).toBeGreaterThan(5000);
  });

  it('searches 10,000 lines in under 100ms', () => {
    const buffer = new LogBuffer({ capacity: 10_000 });
    for (let i = 0; i < 10_000; i += 1) {
      const entry = parseLogLine(
        `2026-01-15T09:32:15.123Z INFO request ${i} ${i % 1000 === 0 ? 'UNIQUE_MARKER' : ''}`,
        {
          service: 'api',
          stream: 'stdout',
        },
      );
      buffer.append(entry);
    }

    const start = performance.now();
    const results = buffer.search('UNIQUE_MARKER');
    const elapsed = performance.now() - start;

    console.log(`Search time: ${elapsed.toFixed(2)}ms (${results.length} matches)`);
    expect(elapsed).toBeLessThan(100);
    expect(results.length).toBe(10);
  });
});
