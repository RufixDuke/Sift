export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'unknown';

export type ServiceType =
  | 'server'
  | 'client'
  | 'mobile'
  | 'bundler'
  | 'database'
  | 'cache'
  | 'webhook'
  | 'network'
  | 'worker'
  | 'generic';

export type ServiceStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'stopped'
  | 'crashed'
  | 'unstable';

export interface DisplayEntry {
  timestamp: string;
  serviceTag: string;
  levelSymbol: string;
  message: string;
  raw: string;
}

export interface ParsedLogEntry {
  id: number;
  raw: string;
  stripped: string;
  service: string;
  stream: 'stdout' | 'stderr';
  timestamp?: Date;
  level: LogLevel;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  display: DisplayEntry;
}

export interface ServiceConfig {
  name: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  color?: string;
  parser?: string;
  dependsOn?: string[];
  readyPattern?: string;
  readyTimeout?: number;
  restart?: 'never' | 'on-failure' | 'always';
  maxRestarts?: number;
  tty?: boolean;
  interactive?: boolean;
  suppress?: boolean;
  prefix?: string;
  type?: ServiceType;
}

export interface SiftSettings {
  bufferSize?: number;
  showTimestamp?: boolean;
  showServiceName?: boolean;
  showStreamIndicator?: boolean;
  stripAnsi?: boolean;
  injectTimestamps?: boolean;
  autoScroll?: boolean;
  autoRestart?: boolean;
  theme?: 'dark' | 'light';
  sidebarWidth?: number;
  dateFormat?: string;
}

export interface SiftConfig {
  $schema?: string;
  version: number;
  services: ServiceConfig[];
  settings?: SiftSettings;
}

export interface ServiceState extends ServiceConfig {
  status: ServiceStatus;
  pid?: number;
  exitCode?: number | null;
  logCount: number;
  lastOutputAt?: Date;
  restartCount: number;
  color: string;
}

export interface Filters {
  level?: LogLevel | 'all';
  services?: string[];
  query?: string;
  requestId?: string;
}

export interface ParserContext {
  service: string;
  stream: 'stdout' | 'stderr';
  formatHint?: string;
}

export interface ParserResult {
  timestamp?: Date;
  level: LogLevel;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export type ParserFn = (
  line: string,
  stripped: string,
  context: ParserContext,
) => ParserResult | null;

export interface ServicePattern {
  script: string | RegExp;
  name: string;
  type: ServiceType;
}

export const SERVICE_PATTERNS: ServicePattern[] = [
  { script: 'dev', name: 'web', type: 'client' },
  { script: 'start', name: 'server', type: 'server' },
  { script: 'server', name: 'api', type: 'server' },
  { script: 'api', name: 'api', type: 'server' },
  { script: 'web', name: 'web', type: 'client' },
  { script: 'app', name: 'app', type: 'client' },
  { script: 'expo', name: 'mobile', type: 'mobile' },
  { script: 'metro', name: 'metro', type: 'bundler' },
  { script: 'db', name: 'db', type: 'database' },
  { script: 'postgres', name: 'db', type: 'database' },
  { script: 'redis', name: 'redis', type: 'cache' },
  { script: 'stripe', name: 'stripe', type: 'webhook' },
  { script: 'tunnel', name: 'tunnel', type: 'network' },
  { script: 'worker', name: 'worker', type: 'worker' },
];

export const LOG_LEVEL_PATTERNS: Record<LogLevel, RegExp[]> = {
  error: [
    /\bERROR\b/i,
    /\bERR\b/i,
    /\bFATAL\b/i,
    /\bCRITICAL\b/i,
    /✗/,
    /\[error\]/i,
    /level[:=]50/i,
    /HTTP\/\d\.\d\"\s+5\d{2}/,
  ],
  warn: [
    /\bWARN(ING)?\b/i,
    /⚠/,
    /\[warn\]/i,
    /level[:=]40/i,
    /HTTP\/\d\.\d\"\s+4\d{2}/,
  ],
  info: [
    /\bINFO\b/i,
    /\bLOG\b/i,
    /ℹ/,
    /✓/,
    /\[info\]/i,
    /level[:=]30/i,
    /HTTP\/\d\.\d\"\s+[23]\d{2}/,
  ],
  debug: [
    /\bDEBUG\b/i,
    /\bDBG\b/i,
    /\[debug\]/i,
    /level[:=]20/i,
    /\bverbose\b/i,
  ],
  trace: [/\bTRACE\b/i, /\[trace\]/i, /level[:=]10/i],
  unknown: [],
};

export const TIMESTAMP_PATTERNS = [
  // ISO 8601: 2026-01-15T09:32:15.123Z or 2026-01-15T09:32:15+00:00
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/,
  // Date + time: 2026-01-15 09:32:15.123
  /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(\.\d+)?/,
  // Date + time comma: 2026-01-15 09:32:15,123
  /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d+/,
  // Bracketed time: [09:32:15] or [09:32:15.123]
  /^\[(\d{2}:\d{2}:\d{2}(\.\d+)?)\]/,
  // Simple time: 09:32:15 or 09:32:15.123
  /^\d{2}:\d{2}:\d{2}(\.\d+)?/,
  // Unix ms timestamp at start of line
  /^\d{13}(?=\s|$)/,
  // Unix seconds timestamp at start of line
  /^\d{10}(?=\s|$)/,
];

export const REQUEST_ID_PATTERNS = [
  /(?:req(?:uest)?[-_]?id|rid|correlation[-_]?id|trace[-_]?id)[:=\s]+([a-zA-Z0-9_-]+)/i,
  /\[req:([a-zA-Z0-9_-]+)\]/i,
  /request_id["']?\s*[:=]\s*["']?([a-zA-Z0-9_-]+)/i,
];

export const SERVICE_COLORS = [
  '#00BCD4',
  '#2196F3',
  '#9C27B0',
  '#FF9800',
  '#607D8B',
  '#E91E63',
  '#3F51B5',
  '#795548',
  '#009688',
  '#FFC107',
];

export const DEFAULT_SETTINGS: Required<SiftSettings> = {
  bufferSize: 10000,
  showTimestamp: true,
  showServiceName: true,
  showStreamIndicator: false,
  stripAnsi: false,
  injectTimestamps: false,
  autoScroll: true,
  autoRestart: false,
  theme: 'dark',
  sidebarWidth: 25,
  dateFormat: 'HH:MM:SS',
};
