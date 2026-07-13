import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getLastRun,
  saveLastRun,
  clearLastRun,
  applyLastRun,
  summarizeLastRun,
} from '../src/core/lastRun.js';
import type { ServiceConfig } from '../src/types/index.js';

describe('lastRun store', () => {
  let storeDir: string;
  let projectDir: string;

  beforeEach(() => {
    storeDir = mkdtempSync(join(tmpdir(), 'sift-lastrun-store-'));
    projectDir = mkdtempSync(join(tmpdir(), 'sift-lastrun-project-'));
  });

  afterEach(() => {
    rmSync(storeDir, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('returns undefined when nothing has been saved for a project', () => {
    expect(getLastRun(projectDir, { storeDir })).toBeUndefined();
  });

  it('saves and retrieves a selection scoped to the project directory', () => {
    saveLastRun(
      projectDir,
      {
        serviceNames: ['web', 'api'],
        commandOverrides: { api: 'nodemon --inspect src/index.js' },
        customServices: [
          { name: 'stripe-cli', command: 'stripe listen --forward-to localhost:3000/hook' },
        ],
      },
      { storeDir },
    );

    const entry = getLastRun(projectDir, { storeDir });
    expect(entry).toBeDefined();
    expect(entry!.serviceNames).toEqual(['web', 'api']);
    expect(entry!.commandOverrides.api).toBe('nodemon --inspect src/index.js');
    expect(entry!.customServices).toHaveLength(1);
    expect(entry!.savedAt).toBeGreaterThan(0);
  });

  it('keeps selections for different projects independent', () => {
    const otherProjectDir = mkdtempSync(join(tmpdir(), 'sift-lastrun-project2-'));
    try {
      saveLastRun(
        projectDir,
        { serviceNames: ['web'], commandOverrides: {}, customServices: [] },
        { storeDir },
      );
      saveLastRun(
        otherProjectDir,
        { serviceNames: ['api'], commandOverrides: {}, customServices: [] },
        { storeDir },
      );

      expect(getLastRun(projectDir, { storeDir })?.serviceNames).toEqual(['web']);
      expect(getLastRun(otherProjectDir, { storeDir })?.serviceNames).toEqual(['api']);
    } finally {
      rmSync(otherProjectDir, { recursive: true, force: true });
    }
  });

  it('clears a saved selection', () => {
    saveLastRun(
      projectDir,
      { serviceNames: ['web'], commandOverrides: {}, customServices: [] },
      { storeDir },
    );
    expect(getLastRun(projectDir, { storeDir })).toBeDefined();

    clearLastRun(projectDir, { storeDir });
    expect(getLastRun(projectDir, { storeDir })).toBeUndefined();
  });

  it('overwrites the previous selection on save', () => {
    saveLastRun(
      projectDir,
      { serviceNames: ['web'], commandOverrides: {}, customServices: [] },
      { storeDir },
    );
    saveLastRun(
      projectDir,
      { serviceNames: ['api', 'db'], commandOverrides: {}, customServices: [] },
      { storeDir },
    );

    expect(getLastRun(projectDir, { storeDir })?.serviceNames).toEqual(['api', 'db']);
  });
});

describe('applyLastRun', () => {
  const detected: ServiceConfig[] = [
    { name: 'web', command: 'next dev' },
    { name: 'api', command: 'nodemon src/index.js' },
    { name: 'worker', command: 'celery -A app worker -l info', guessed: true },
  ];

  it('filters detected services down to the saved names', () => {
    const result = applyLastRun(detected, {
      serviceNames: ['web', 'api'],
      commandOverrides: {},
      customServices: [],
      savedAt: Date.now(),
    });

    expect(result.map((s) => s.name).sort()).toEqual(['api', 'web']);
  });

  it('re-applies a saved command edit for a guessed service', () => {
    const result = applyLastRun(detected, {
      serviceNames: ['worker'],
      commandOverrides: { worker: 'celery -A myapp worker -l info' },
      customServices: [],
      savedAt: Date.now(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].command).toBe('celery -A myapp worker -l info');
  });

  it('appends saved custom services not found by detection', () => {
    const result = applyLastRun(detected, {
      serviceNames: ['web'],
      commandOverrides: {},
      customServices: [
        { name: 'stripe-cli', command: 'stripe listen --forward-to localhost:3000/hook' },
      ],
      savedAt: Date.now(),
    });

    expect(result.map((s) => s.name)).toEqual(['web', 'stripe-cli']);
  });
});

describe('summarizeLastRun', () => {
  it('joins detected and custom service names', () => {
    const summary = summarizeLastRun({
      serviceNames: ['web', 'api'],
      commandOverrides: {},
      customServices: [{ name: 'stripe-cli', command: 'stripe listen' }],
      savedAt: Date.now(),
    });

    expect(summary).toBe('web, api, stripe-cli');
  });
});
