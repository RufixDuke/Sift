import { describe, it, expect, vi } from 'vitest';
import { LogBuffer } from '../src/core/buffer.js';
import type { ParsedLogEntry } from '../src/types/index.js';

function makeEntry(level: ParsedLogEntry['level'], service = 'api'): ParsedLogEntry {
  return {
    id: 0,
    raw: 'test',
    stripped: 'test',
    service,
    stream: 'stdout',
    level,
    message: 'test',
    display: {
      timestamp: '',
      serviceTag: service,
      levelSymbol: '',
      message: 'test',
      raw: 'test',
    },
  };
}

describe('LogBuffer', () => {
  it('appends entries and returns them', () => {
    const buffer = new LogBuffer({ capacity: 10 });
    buffer.append(makeEntry('info'));
    buffer.append(makeEntry('error'));
    expect(buffer.length()).toBe(2);
    expect(buffer.countByLevel().info).toBe(1);
    expect(buffer.countByLevel().error).toBe(1);
  });

  it('overwrites old entries when capacity is exceeded', () => {
    const buffer = new LogBuffer({ capacity: 3 });
    buffer.append(makeEntry('info'));
    buffer.append(makeEntry('info'));
    buffer.append(makeEntry('info'));
    buffer.append(makeEntry('error'));
    expect(buffer.length()).toBe(3);
    expect(buffer.countByLevel().info).toBe(2);
    expect(buffer.countByLevel().error).toBe(1);
  });

  it('filters by level', () => {
    const buffer = new LogBuffer({ capacity: 10 });
    buffer.append(makeEntry('info'));
    buffer.append(makeEntry('error'));
    const visible = buffer.getVisible({ level: 'error' });
    expect(visible).toHaveLength(1);
    expect(visible[0].level).toBe('error');
  });

  it('searches query text', () => {
    const buffer = new LogBuffer({ capacity: 10 });
    buffer.append({ ...makeEntry('info'), raw: 'hello world', message: 'hello world' });
    buffer.append({ ...makeEntry('info'), raw: 'goodbye', message: 'goodbye' });
    const results = buffer.search('hello');
    expect(results).toHaveLength(1);
  });
});
