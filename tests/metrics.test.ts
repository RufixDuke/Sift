import { describe, it, expect } from 'vitest';
import { extractHttpMetric } from '../src/utils/http.js';
import { MetricsTracker, formatSparkline } from '../src/core/metrics.js';
import type { ParsedLogEntry } from '../src/types/index.js';

function makeEntry(message: string, level: ParsedLogEntry['level'] = 'info', service = 'api'): ParsedLogEntry {
  return {
    id: 1,
    raw: message,
    stripped: message,
    service,
    stream: 'stdout',
    timestamp: new Date(),
    level,
    message,
    display: {
      timestamp: '',
      serviceTag: service,
      levelSymbol: '',
      message,
      raw: message,
    },
  };
}

describe('extractHttpMetric', () => {
  it('extracts status and response time from access logs', () => {
    const metric = extractHttpMetric('GET /api/users 200 45ms');
    expect(metric).toEqual({ method: 'GET', status: 200, responseTimeMs: 45 });
  });

  it('extracts seconds duration', () => {
    const metric = extractHttpMetric('POST /upload 201 1.2s');
    expect(metric).toEqual({ method: 'POST', status: 201, responseTimeMs: 1200 });
  });

  it('returns null when no status is present', () => {
    expect(extractHttpMetric('Server started')).toBeNull();
  });

  it('returns null for status-only lines without method or path', () => {
    expect(extractHttpMetric('Process exited with code 200')).toBeNull();
  });
});

describe('MetricsTracker', () => {
  it('computes requests per minute and average response time', () => {
    const tracker = new MetricsTracker({ bucketSizeMs: 1000, bucketCount: 60 });
    tracker.observe(makeEntry('GET /api/users 200 45ms'));
    tracker.observe(makeEntry('GET /api/users 200 55ms'));
    tracker.observe(makeEntry('POST /api/users 201 100ms'));

    const snapshot = tracker.snapshot('api');
    expect(snapshot.requestsPerMinute).toBeGreaterThan(0);
    expect(snapshot.avgResponseTimeMs).toBeCloseTo(66.7, 1);
    expect(snapshot.health).toBe('healthy');
  });

  it('flags unhealthy when error rate is high', () => {
    const tracker = new MetricsTracker({ bucketSizeMs: 1000, bucketCount: 60 });
    for (let i = 0; i < 10; i += 1) {
      tracker.observe(makeEntry('GET /api/users 500 45ms', 'error'));
    }
    tracker.observe(makeEntry('GET /api/users 200 45ms'));

    const snapshot = tracker.snapshot('api');
    expect(snapshot.errorRate).toBeCloseTo(10 / 11, 2);
    expect(snapshot.health).toBe('unhealthy');
  });

  it('flags degraded at 5% error rate', () => {
    const tracker = new MetricsTracker({ bucketSizeMs: 1000, bucketCount: 60 });
    for (let i = 0; i < 19; i += 1) {
      tracker.observe(makeEntry('GET /api/users 200 45ms'));
    }
    tracker.observe(makeEntry('GET /api/users 500 45ms', 'error'));

    const snapshot = tracker.snapshot('api');
    expect(snapshot.health).toBe('degraded');
  });

  it('marks crashed services as unhealthy', () => {
    const tracker = new MetricsTracker({ bucketSizeMs: 1000, bucketCount: 60 });
    const snapshot = tracker.snapshot('api', 'crashed');
    expect(snapshot.health).toBe('unhealthy');
  });

  it('aggregates error series across services', () => {
    const tracker = new MetricsTracker({ bucketSizeMs: 1000, bucketCount: 60 });
    tracker.observe(makeEntry('GET /api/users 500 45ms', 'error', 'api'));
    tracker.observe(makeEntry('GET /web 200 45ms', 'info', 'web'));

    const series = tracker.aggregateErrorSeries();
    expect(series.some((v) => v > 0)).toBe(true);
  });
});

describe('formatSparkline', () => {
  it('renders blocks for values', () => {
    expect(formatSparkline([0, 0.5, 1], 3)).toMatch(/^[\u2581-\u2587█]+$/);
  });

  it('handles all-zero values', () => {
    expect(formatSparkline([0, 0, 0], 3)).toBe('▁▁▁');
  });
});
