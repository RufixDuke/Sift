export interface HttpMetric {
  method?: string;
  status: number;
  responseTimeMs?: number;
}

const STATUS_PATTERN = /\b(\d{3})\b/;

const METHOD_PATTERN = /\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b/i;

const RESPONSE_TIME_PATTERNS = [
  // 45ms, 1.2s, 1234 ns
  /(\d+(?:\.\d+)?)\s*(ms|s|ns)\b/i,
  // response_time=45, duration=1.2
  /(?:response[_-]?time|duration|latency)[:=]\s*(\d+(?:\.\d+)?)\s*(ms|s|ns)?/i,
];

function parseDuration(value: string, unit: string | undefined): number | undefined {
  const num = Number.parseFloat(value);
  if (Number.isNaN(num)) return undefined;
  if (!unit) return num;
  const lower = unit.toLowerCase();
  if (lower === 'ns') return num / 1_000_000;
  if (lower === 's') return num * 1000;
  return num; // ms default
}

export function extractHttpMetric(message: string): HttpMetric | null {
  const statusMatch = message.match(STATUS_PATTERN);
  if (!statusMatch) return null;

  const status = Number.parseInt(statusMatch[1], 10);
  if (status < 100 || status > 599) return null;

  // Require an HTTP method or a common access-log shape to reduce false positives.
  const methodMatch = message.match(METHOD_PATTERN);
  const hasPath = /"\s*(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+\//i.test(message) ||
    /\b(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s+\/\S+/i.test(message);

  if (!methodMatch && !hasPath) return null;

  let responseTimeMs: number | undefined;
  for (const pattern of RESPONSE_TIME_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      responseTimeMs = parseDuration(match[1], match[2]);
      if (responseTimeMs !== undefined) break;
    }
  }

  return {
    method: methodMatch?.[1].toUpperCase(),
    status,
    responseTimeMs,
  };
}
