import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { ServiceSpawner, type RawLineEvent } from '../src/core/spawner.js';

function waitForLine(spawner: ServiceSpawner): Promise<RawLineEvent> {
  return new Promise((resolve) => {
    spawner.once('rawLine', resolve);
  });
}

describe('ServiceSpawner env injection', () => {
  it('sets PYTHONUNBUFFERED so buffered interpreters flush output immediately', async () => {
    const spawner = new ServiceSpawner({
      services: [
        {
          name: 'probe',
          command: `node -e "process.stdout.write(String(process.env.PYTHONUNBUFFERED))"`,
        },
      ],
    });

    const linePromise = waitForLine(spawner);
    spawner.start();
    const event = await linePromise;
    await spawner.stop();

    expect(event.raw).toBe('1');
  });

  it('lets an explicit service.env override the default', async () => {
    const spawner = new ServiceSpawner({
      services: [
        {
          name: 'probe',
          command: `node -e "process.stdout.write(String(process.env.PYTHONUNBUFFERED))"`,
          env: { PYTHONUNBUFFERED: '0' },
        },
      ],
    });

    const linePromise = waitForLine(spawner);
    spawner.start();
    const event = await linePromise;
    await spawner.stop();

    expect(event.raw).toBe('0');
  });

  describe('RUBYOPT (MRI stdout/stderr sync)', () => {
    const originalRubyOpt = process.env.RUBYOPT;

    afterEach(() => {
      if (originalRubyOpt === undefined) delete process.env.RUBYOPT;
      else process.env.RUBYOPT = originalRubyOpt;
    });

    it('requires a helper script that forces STDOUT/STDERR sync', async () => {
      const spawner = new ServiceSpawner({
        services: [
          {
            name: 'probe',
            command: `node -e "process.stdout.write(String(process.env.RUBYOPT))"`,
          },
        ],
      });

      const linePromise = waitForLine(spawner);
      spawner.start();
      const event = await linePromise;
      await spawner.stop();

      const match = event.raw.match(/^-r(.+)$/);
      expect(match).not.toBeNull();
      const helperPath = match![1];
      expect(existsSync(helperPath)).toBe(true);
      expect(readFileSync(helperPath, 'utf-8')).toContain('STDOUT.sync = true');
    });

    it('appends to an existing RUBYOPT instead of clobbering it', async () => {
      process.env.RUBYOPT = '-W0';

      const spawner = new ServiceSpawner({
        services: [
          {
            name: 'probe',
            command: `node -e "process.stdout.write(String(process.env.RUBYOPT))"`,
          },
        ],
      });

      const linePromise = waitForLine(spawner);
      spawner.start();
      const event = await linePromise;
      await spawner.stop();

      expect(event.raw).toMatch(/^-r.+ -W0$/);
    });

    it('lets an explicit service.env override RUBYOPT entirely', async () => {
      const spawner = new ServiceSpawner({
        services: [
          {
            name: 'probe',
            command: `node -e "process.stdout.write(String(process.env.RUBYOPT))"`,
            env: { RUBYOPT: '-Wcustom' },
          },
        ],
      });

      const linePromise = waitForLine(spawner);
      spawner.start();
      const event = await linePromise;
      await spawner.stop();

      expect(event.raw).toBe('-Wcustom');
    });
  });
});
