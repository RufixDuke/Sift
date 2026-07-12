import type { ParsedLogEntry, LogLevel } from '../types/index.js';
import { extractHttpMetric } from '../utils/http.js';

export type ServiceHealth = 'healthy' | 'degraded' | 'unhealthy';

export interface MetricsSnapshot {
  requestsPerMinute: number;
  errorRate: number;
  avgResponseTimeMs: number;
  health: ServiceHealth;
}

interface Bucket {
  timestamp: number;
  requests: number;
  errors: number;
  totalResponseTimeMs: number;
  responseTimeCount: number;
}

export interface MetricsTrackerOptions {
  bucketSizeMs?: number;
  bucketCount?: number;
}

export class MetricsTracker {
  private bucketSizeMs: number;
  private bucketCount: number;
  private bucketsByService = new Map<string, Bucket[]>();

  constructor(options: MetricsTrackerOptions = {}) {
    this.bucketSizeMs = options.bucketSizeMs ?? 10_000;
    this.bucketCount = options.bucketCount ?? 60;
  }

  observe(entry: ParsedLogEntry): void {
    const metric = extractHttpMetric(entry.message);
    if (!metric) return;

    const bucket = this.getBucket(entry.service, entry.timestamp);
    bucket.requests += 1;
    if (metric.status >= 500 || entry.level === 'error') {
      bucket.errors += 1;
    }
    if (metric.responseTimeMs !== undefined) {
      bucket.totalResponseTimeMs += metric.responseTimeMs;
      bucket.responseTimeCount += 1;
    }
  }

  snapshot(service: string, serviceStatus?: string): MetricsSnapshot {
    const buckets = this.getBuckets(service);
    const { requests, errors, totalResponseTimeMs, responseTimeCount } = this.aggregate(buckets);

    const windowMinutes = (this.bucketSizeMs * this.bucketCount) / 60_000;
    const requestsPerMinute = windowMinutes > 0 ? requests / windowMinutes : 0;
    const errorRate = requests > 0 ? errors / requests : 0;
    const avgResponseTimeMs = responseTimeCount > 0 ? totalResponseTimeMs / responseTimeCount : 0;

    return {
      requestsPerMinute,
      errorRate,
      avgResponseTimeMs,
      health: this.computeHealth(errorRate, requests, serviceStatus),
    };
  }

  aggregateErrorSeries(): number[] {
    const services = Array.from(this.bucketsByService.keys());
    const series: number[] = new Array(this.bucketCount).fill(0);

    for (const service of services) {
      const buckets = this.getBuckets(service);
      for (let i = 0; i < this.bucketCount; i += 1) {
        const bucket = buckets[i];
        if (bucket && bucket.requests > 0) {
          series[i] += bucket.errors / bucket.requests;
        }
      }
    }

    return series;
  }

  aggregateRequestsPerMinute(): number {
    let totalRequests = 0;
    for (const service of this.bucketsByService.keys()) {
      totalRequests += this.aggregate(this.getBuckets(service)).requests;
    }
    const windowMinutes = (this.bucketSizeMs * this.bucketCount) / 60_000;
    return windowMinutes > 0 ? totalRequests / windowMinutes : 0;
  }

  services(): string[] {
    return Array.from(this.bucketsByService.keys());
  }

  private computeHealth(errorRate: number, requests: number, serviceStatus?: string): ServiceHealth {
    if (serviceStatus === 'crashed') return 'unhealthy';
    if (requests === 0) return 'healthy';
    if (errorRate >= 0.1) return 'unhealthy';
    if (errorRate >= 0.01) return 'degraded';
    return 'healthy';
  }

  private aggregate(buckets: (Bucket | null)[]): Required<Omit<Bucket, 'timestamp'>> {
    return buckets.reduce(
      (acc, bucket) => {
        if (!bucket) return acc;
        return {
          requests: acc.requests + bucket.requests,
          errors: acc.errors + bucket.errors,
          totalResponseTimeMs: acc.totalResponseTimeMs + bucket.totalResponseTimeMs,
          responseTimeCount: acc.responseTimeCount + bucket.responseTimeCount,
        };
      },
      { requests: 0, errors: 0, totalResponseTimeMs: 0, responseTimeCount: 0 },
    );
  }

  private getBucket(service: string, timestamp?: Date): Bucket {
    const buckets = this.getBuckets(service);
    const now = timestamp?.getTime() ?? Date.now();
    const index = this.bucketIndex(now);
    let bucket = buckets[index];

    if (!bucket || bucket.timestamp < now - this.bucketSizeMs) {
      bucket = {
        timestamp: now,
        requests: 0,
        errors: 0,
        totalResponseTimeMs: 0,
        responseTimeCount: 0,
      };
      buckets[index] = bucket;
    }

    return bucket;
  }

  private getBuckets(service: string): Bucket[] {
    let buckets = this.bucketsByService.get(service);
    if (!buckets) {
      buckets = new Array(this.bucketCount).fill(null);
      this.bucketsByService.set(service, buckets);
    }
    return buckets;
  }

  private bucketIndex(timestamp: number): number {
    return Math.floor(timestamp / this.bucketSizeMs) % this.bucketCount;
  }
}

export function formatSparkline(values: number[], width = 30): string {
  if (values.length === 0) return '';
  const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const sliced = values.slice(-width);
  const max = Math.max(...sliced);
  if (max === 0) return '▁'.repeat(sliced.length);
  return sliced
    .map((v) => blocks[Math.min(blocks.length - 1, Math.floor((v / max) * (blocks.length - 1)))])
    .join('');
}

export function formatNumber(value: number, decimals = 1): string {
  if (value >= 1000) return `${(value / 1000).toFixed(decimals)}k`;
  return value.toFixed(decimals);
}
