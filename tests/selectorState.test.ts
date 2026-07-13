import { describe, it, expect } from 'vitest';
import {
  initSelectorState,
  reduceSelectorState,
  resolveSelection,
  addRowIndex,
  type SelectorState,
} from '../src/core/selectorState.js';
import type { ServiceConfig } from '../src/types/index.js';

const DETECTED: ServiceConfig[] = [
  { name: 'web', command: 'next dev' },
  { name: 'api', command: 'nodemon src/index.js' },
  { name: 'worker', command: 'celery -A app worker -l info', guessed: true },
];

describe('initSelectorState', () => {
  it('checks non-guessed services and leaves guessed ones unchecked', () => {
    const state = initSelectorState(DETECTED);
    expect(state.rows.find((r) => r.name === 'web')?.checked).toBe(true);
    expect(state.rows.find((r) => r.name === 'api')?.checked).toBe(true);
    expect(state.rows.find((r) => r.name === 'worker')?.checked).toBe(false);
  });

  it('applies last-run selection and command overrides over defaults', () => {
    const state = initSelectorState(DETECTED, {
      serviceNames: ['worker'],
      commandOverrides: { worker: 'celery -A myapp worker -l info' },
      customServices: [{ name: 'stripe-cli', command: 'stripe listen' }],
      savedAt: Date.now(),
    });

    expect(state.rows.find((r) => r.name === 'web')?.checked).toBe(false);
    const worker = state.rows.find((r) => r.name === 'worker');
    expect(worker?.checked).toBe(true);
    expect(worker?.command).toBe('celery -A myapp worker -l info');

    const custom = state.rows.find((r) => r.name === 'stripe-cli');
    expect(custom?.checked).toBe(true);
    expect(custom?.custom).toBe(true);
  });
});

describe('reduceSelectorState navigation and toggling', () => {
  it('moves the cursor down and clamps at the add-custom row', () => {
    let state = initSelectorState(DETECTED);
    for (let i = 0; i < 10; i++) state = reduceSelectorState(state, { type: 'MOVE_DOWN' });
    expect(state.cursor).toBe(addRowIndex(state));
  });

  it('moves the cursor up and clamps at zero', () => {
    let state = initSelectorState(DETECTED);
    state = reduceSelectorState(state, { type: 'MOVE_UP' });
    expect(state.cursor).toBe(0);
  });

  it('toggles the checked state of the row under the cursor', () => {
    let state = initSelectorState(DETECTED);
    expect(state.rows[0].checked).toBe(true);
    state = reduceSelectorState(state, { type: 'TOGGLE' });
    expect(state.rows[0].checked).toBe(false);
    state = reduceSelectorState(state, { type: 'TOGGLE' });
    expect(state.rows[0].checked).toBe(true);
  });

  it('does not toggle when the cursor is on the add-custom row', () => {
    let state = initSelectorState(DETECTED);
    state = { ...state, cursor: addRowIndex(state) };
    const before = state.rows.map((r) => r.checked);
    state = reduceSelectorState(state, { type: 'TOGGLE' });
    expect(state.rows.map((r) => r.checked)).toEqual(before);
  });
});

describe('reduceSelectorState editing a command', () => {
  function editRow(state: SelectorState, rowIndex: number, newCommand: string): SelectorState {
    let next = { ...state, cursor: rowIndex };
    next = reduceSelectorState(next, { type: 'START_EDIT' });
    next = reduceSelectorState(next, { type: 'CHANGE_EDIT_VALUE', value: newCommand });
    return reduceSelectorState(next, { type: 'SUBMIT_EDIT' });
  }

  it('starts edit mode pre-filled with the current command', () => {
    let state = initSelectorState(DETECTED);
    state = reduceSelectorState(state, { type: 'START_EDIT' });
    expect(state.mode).toBe('editCommand');
    expect(state.editValue).toBe('next dev');
  });

  it('commits an edited command and returns to list mode', () => {
    const workerIdx = DETECTED.findIndex((s) => s.name === 'worker');
    let state = initSelectorState(DETECTED);
    state = editRow(state, workerIdx, 'celery -A myapp worker -l info');

    expect(state.mode).toBe('list');
    expect(state.rows[workerIdx].command).toBe('celery -A myapp worker -l info');
  });

  it('discards the edit and keeps the original command on Esc', () => {
    let state = initSelectorState(DETECTED);
    state = reduceSelectorState(state, { type: 'START_EDIT' });
    state = reduceSelectorState(state, { type: 'CHANGE_EDIT_VALUE', value: 'rm -rf /' });
    state = reduceSelectorState(state, { type: 'CANCEL_EDIT' });

    expect(state.mode).toBe('list');
    expect(state.rows[0].command).toBe('next dev');
  });

  it('ignores an empty submitted command and keeps the original', () => {
    let state = initSelectorState(DETECTED);
    state = reduceSelectorState(state, { type: 'START_EDIT' });
    state = reduceSelectorState(state, { type: 'CHANGE_EDIT_VALUE', value: '   ' });
    state = reduceSelectorState(state, { type: 'SUBMIT_EDIT' });

    expect(state.mode).toBe('list');
    expect(state.rows[0].command).toBe('next dev');
  });
});

describe('reduceSelectorState adding a custom service', () => {
  it('walks through addName -> addCommand and appends a new checked row', () => {
    let state = initSelectorState(DETECTED);
    state = { ...state, cursor: addRowIndex(state) };
    state = reduceSelectorState(state, { type: 'START_EDIT' });
    expect(state.mode).toBe('addName');

    state = reduceSelectorState(state, { type: 'CHANGE_EDIT_VALUE', value: 'stripe-cli' });
    state = reduceSelectorState(state, { type: 'SUBMIT_EDIT' });
    expect(state.mode).toBe('addCommand');
    expect(state.pendingCustomName).toBe('stripe-cli');

    state = reduceSelectorState(state, {
      type: 'CHANGE_EDIT_VALUE',
      value: 'stripe listen --forward-to localhost:3000/hook',
    });
    state = reduceSelectorState(state, { type: 'SUBMIT_EDIT' });

    expect(state.mode).toBe('list');
    const added = state.rows.find((r) => r.name === 'stripe-cli');
    expect(added).toBeDefined();
    expect(added?.checked).toBe(true);
    expect(added?.custom).toBe(true);
    expect(added?.command).toBe('stripe listen --forward-to localhost:3000/hook');
  });

  it('cancels the add flow on an empty name and returns to list mode', () => {
    let state = initSelectorState(DETECTED);
    const originalRowCount = state.rows.length;
    state = { ...state, cursor: addRowIndex(state) };
    state = reduceSelectorState(state, { type: 'START_EDIT' });
    state = reduceSelectorState(state, { type: 'CHANGE_EDIT_VALUE', value: '   ' });
    state = reduceSelectorState(state, { type: 'SUBMIT_EDIT' });

    expect(state.mode).toBe('list');
    expect(state.rows).toHaveLength(originalRowCount);
  });
});

describe('resolveSelection', () => {
  it('produces services only for checked rows, using edited commands', () => {
    let state = initSelectorState(DETECTED);
    state = reduceSelectorState({ ...state, cursor: 2 }, { type: 'TOGGLE' }); // check worker
    const workerRow = state.rows.findIndex((r) => r.name === 'worker');
    state = { ...state, cursor: workerRow };
    state = reduceSelectorState(state, { type: 'START_EDIT' });
    state = reduceSelectorState(state, {
      type: 'CHANGE_EDIT_VALUE',
      value: 'celery -A myapp worker -l info',
    });
    state = reduceSelectorState(state, { type: 'SUBMIT_EDIT' });

    const result = resolveSelection(state, DETECTED);
    expect(result.services.map((s) => s.name).sort()).toEqual(['api', 'web', 'worker']);
    expect(result.commandOverrides.worker).toBe('celery -A myapp worker -l info');
    expect(result.serviceNames.sort()).toEqual(['api', 'web', 'worker']);
    expect(result.customServices).toEqual([]);
  });

  it('excludes unchecked rows entirely', () => {
    const state = initSelectorState(DETECTED);
    const result = resolveSelection(state, DETECTED);
    expect(result.services.map((s) => s.name).sort()).toEqual(['api', 'web']);
  });

  it('includes custom services separately from detected ones', () => {
    let state = initSelectorState(DETECTED);
    state = { ...state, cursor: addRowIndex(state) };
    state = reduceSelectorState(state, { type: 'START_EDIT' });
    state = reduceSelectorState(state, { type: 'CHANGE_EDIT_VALUE', value: 'logs' });
    state = reduceSelectorState(state, { type: 'SUBMIT_EDIT' });
    state = reduceSelectorState(state, { type: 'CHANGE_EDIT_VALUE', value: 'tail -f app.log' });
    state = reduceSelectorState(state, { type: 'SUBMIT_EDIT' });

    const result = resolveSelection(state, DETECTED);
    expect(result.customServices).toEqual([
      { name: 'logs', command: 'tail -f app.log', cwd: undefined, color: undefined },
    ]);
    expect(result.services.map((s) => s.name)).toContain('logs');
  });
});
