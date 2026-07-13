import { describe, it, expect } from 'vitest';
import { MultiLineAssembler } from '../src/core/multiline.js';

describe('MultiLineAssembler', () => {
  it('groups stack trace continuation lines', () => {
    const assembler = new MultiLineAssembler();
    const entries: { lines: string[]; service: string }[] = [];
    assembler.on('entry', (e) => entries.push(e));

    assembler.feed({
      raw: 'Error: something broke',
      service: 'api',
      stream: 'stderr',
      serviceColor: '#f00',
      sequence: 1,
    });
    assembler.feed({
      raw: '    at /app/src/auth.js:45:12',
      service: 'api',
      stream: 'stderr',
      serviceColor: '#f00',
      sequence: 2,
    });
    assembler.feed({
      raw: '    at /app/src/routes.js:23:10',
      service: 'api',
      stream: 'stderr',
      serviceColor: '#f00',
      sequence: 3,
    });
    assembler.feed({
      raw: 'INFO next request',
      service: 'api',
      stream: 'stdout',
      serviceColor: '#f00',
      sequence: 4,
    });
    assembler.flush();

    expect(entries).toHaveLength(2);
    expect(entries[0].lines).toHaveLength(3);
    expect(entries[0].lines[0]).toBe('Error: something broke');
    expect(entries[1].lines[0]).toBe('INFO next request');
  });

  it('keeps unrelated services separate', () => {
    const assembler = new MultiLineAssembler();
    const entries: { lines: string[]; service: string }[] = [];
    assembler.on('entry', (e) => entries.push(e));

    assembler.feed({
      raw: 'Error: api broke',
      service: 'api',
      stream: 'stderr',
      serviceColor: '#f00',
      sequence: 1,
    });
    assembler.feed({
      raw: 'INFO web ok',
      service: 'web',
      stream: 'stdout',
      serviceColor: '#0f0',
      sequence: 2,
    });
    assembler.feed({
      raw: '    at api.js:1',
      service: 'api',
      stream: 'stderr',
      serviceColor: '#f00',
      sequence: 3,
    });
    assembler.flush();

    expect(entries).toHaveLength(2);
    expect(entries[0].service).toBe('api');
    expect(entries[1].service).toBe('web');
    expect(entries[0].lines).toHaveLength(2);
  });
});
