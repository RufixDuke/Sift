import type { ParserContext, ParserResult } from '../types/index.js';
import { parseJsonLine } from './json-line.js';
import { parseBracketed } from './bracketed.js';
import { parsePrefixed } from './prefixed.js';
import { parseAccessLog } from './access-log.js';
import { parseDocker } from './docker.js';
import { parseLogfmt } from './logfmt.js';
import { parseGeneric } from './generic.js';

import { parseLanguage } from './language.js';

export type ParserName =
  | 'json-line'
  | 'bracketed'
  | 'prefixed'
  | 'language'
  | 'access-log'
  | 'docker'
  | 'logfmt'
  | 'generic';

const PARSERS: { name: ParserName; fn: (line: string, stripped: string, ctx: ParserContext) => ParserResult | null }[] = [
  { name: 'json-line', fn: parseJsonLine },
  { name: 'bracketed', fn: parseBracketed },
  { name: 'language', fn: parseLanguage },
  { name: 'prefixed', fn: parsePrefixed },
  { name: 'access-log', fn: parseAccessLog },
  { name: 'docker', fn: parseDocker },
  { name: 'logfmt', fn: parseLogfmt },
  { name: 'generic', fn: parseGeneric },
];

export function parseWithRegistry(
  stripped: string,
  context: ParserContext,
  formatHint?: string,
): ParserResult | null {
  if (formatHint) {
    const parser = PARSERS.find((p) => p.name === formatHint);
    if (parser) {
      return parser.fn(stripped, stripped, context);
    }
  }

  for (const parser of PARSERS) {
    const result = parser.fn(stripped, stripped, context);
    if (result) return result;
  }

  return null;
}

export function detectFormat(stripped: string, context: ParserContext): string | undefined {
  // Service name heuristics
  if (context.service === 'db' || stripped.match(/^[a-zA-Z0-9_.-]+\s*\|/)) return 'docker';

  for (const parser of PARSERS) {
    if (parser.name === 'generic') continue;
    const result = parser.fn(stripped, stripped, context);
    if (result) return parser.name;
  }

  return undefined;
}
