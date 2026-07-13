import Conf from 'conf';
import { resolve } from 'node:path';
import type { ServiceConfig } from '../types/index.js';

export interface LastRunEntry {
  /** Names of detected services that were checked. */
  serviceNames: string[];
  /** Command edits keyed by service name, for rows the user retyped in the picker. */
  commandOverrides: Record<string, string>;
  /** Fully custom services the user typed in via "add custom". */
  customServices: ServiceConfig[];
  savedAt: number;
}

interface LastRunStore {
  projects: Record<string, LastRunEntry>;
}

export interface LastRunStoreOptions {
  /** Overrides where the store file lives — used by tests to avoid touching the user's real config dir. */
  storeDir?: string;
}

function loadStore(options: LastRunStoreOptions = {}): Conf<LastRunStore> {
  return new Conf<LastRunStore>({
    projectName: 'sift-logs',
    configName: 'last-run',
    defaults: { projects: {} },
    ...(options.storeDir ? { cwd: options.storeDir } : {}),
  });
}

function keyFor(cwd: string): string {
  return resolve(cwd);
}

export function getLastRun(cwd: string, options?: LastRunStoreOptions): LastRunEntry | undefined {
  const store = loadStore(options);
  const projects = store.get('projects');
  return projects[keyFor(cwd)];
}

export function saveLastRun(
  cwd: string,
  entry: Omit<LastRunEntry, 'savedAt'>,
  options?: LastRunStoreOptions,
): void {
  const store = loadStore(options);
  const projects = store.get('projects');
  projects[keyFor(cwd)] = { ...entry, savedAt: Date.now() };
  store.set('projects', projects);
}

export function clearLastRun(cwd: string, options?: LastRunStoreOptions): void {
  const store = loadStore(options);
  const projects = store.get('projects');
  delete projects[keyFor(cwd)];
  store.set('projects', projects);
}

/** Applies a saved selection to freshly detected services: filters to the saved names, re-applies command edits, and appends saved custom services. */
export function applyLastRun(detected: ServiceConfig[], entry: LastRunEntry): ServiceConfig[] {
  const selected = detected
    .filter((s) => entry.serviceNames.includes(s.name))
    .map((s) =>
      entry.commandOverrides[s.name] ? { ...s, command: entry.commandOverrides[s.name] } : s,
    );
  return [...selected, ...entry.customServices];
}

export function summarizeLastRun(entry: LastRunEntry): string {
  const names = [...entry.serviceNames, ...entry.customServices.map((s) => s.name)];
  return names.join(', ');
}
