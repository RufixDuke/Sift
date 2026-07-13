import type { ServiceConfig, ServiceType } from '../types/index.js';
import type { LastRunEntry } from './lastRun.js';

export interface SelectorRow {
  name: string;
  command: string;
  cwd?: string;
  color?: string;
  type?: ServiceType;
  guessed?: boolean;
  custom: boolean;
  checked: boolean;
}

export type SelectorMode = 'list' | 'editCommand' | 'addName' | 'addCommand';

export interface SelectorState {
  rows: SelectorRow[];
  cursor: number;
  mode: SelectorMode;
  editValue: string;
  pendingCustomName: string;
}

export type SelectorAction =
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'FOCUS_ADD_ROW' }
  | { type: 'TOGGLE' }
  | { type: 'START_EDIT' }
  | { type: 'CHANGE_EDIT_VALUE'; value: string }
  | { type: 'SUBMIT_EDIT' }
  | { type: 'CANCEL_EDIT' };

/** Index of the always-present "add custom command" row, one past the last service row. */
export function addRowIndex(state: SelectorState): number {
  return state.rows.length;
}

export function initSelectorState(
  detected: ServiceConfig[],
  lastRun?: LastRunEntry,
): SelectorState {
  const rows: SelectorRow[] = detected.map((svc) => {
    const override = lastRun?.commandOverrides[svc.name];
    const checked = lastRun ? lastRun.serviceNames.includes(svc.name) : !svc.guessed;
    return {
      name: svc.name,
      command: override ?? svc.command,
      cwd: svc.cwd,
      color: svc.color,
      type: svc.type,
      guessed: svc.guessed,
      custom: false,
      checked,
    };
  });

  for (const custom of lastRun?.customServices ?? []) {
    rows.push({
      name: custom.name,
      command: custom.command,
      cwd: custom.cwd,
      color: custom.color,
      custom: true,
      checked: true,
    });
  }

  return { rows, cursor: 0, mode: 'list', editValue: '', pendingCustomName: '' };
}

export function reduceSelectorState(state: SelectorState, action: SelectorAction): SelectorState {
  switch (action.type) {
    case 'MOVE_UP':
      if (state.mode !== 'list') return state;
      return { ...state, cursor: Math.max(0, state.cursor - 1) };

    case 'MOVE_DOWN':
      if (state.mode !== 'list') return state;
      return { ...state, cursor: Math.min(addRowIndex(state), state.cursor + 1) };

    case 'FOCUS_ADD_ROW':
      if (state.mode !== 'list') return state;
      return { ...state, cursor: addRowIndex(state) };

    case 'TOGGLE': {
      if (state.mode !== 'list' || state.cursor >= addRowIndex(state)) return state;
      const rows = state.rows.map((row, idx) =>
        idx === state.cursor ? { ...row, checked: !row.checked } : row,
      );
      return { ...state, rows };
    }

    case 'START_EDIT': {
      if (state.mode !== 'list') return state;
      if (state.cursor >= addRowIndex(state)) {
        return { ...state, mode: 'addName', editValue: '' };
      }
      return { ...state, mode: 'editCommand', editValue: state.rows[state.cursor].command };
    }

    case 'CHANGE_EDIT_VALUE':
      return { ...state, editValue: action.value };

    case 'SUBMIT_EDIT': {
      if (state.mode === 'editCommand') {
        const value = state.editValue.trim();
        if (!value) return { ...state, mode: 'list', editValue: '' };
        const rows = state.rows.map((row, idx) =>
          idx === state.cursor ? { ...row, command: value } : row,
        );
        return { ...state, rows, mode: 'list', editValue: '' };
      }

      if (state.mode === 'addName') {
        const name = state.editValue.trim();
        if (!name) return { ...state, mode: 'list', editValue: '' };
        return { ...state, mode: 'addCommand', editValue: '', pendingCustomName: name };
      }

      if (state.mode === 'addCommand') {
        const command = state.editValue.trim();
        if (!command) return { ...state, mode: 'list', editValue: '', pendingCustomName: '' };
        const rows = [
          ...state.rows,
          { name: state.pendingCustomName, command, custom: true, checked: true },
        ];
        return {
          ...state,
          rows,
          cursor: rows.length - 1,
          mode: 'list',
          editValue: '',
          pendingCustomName: '',
        };
      }

      return state;
    }

    case 'CANCEL_EDIT':
      return { ...state, mode: 'list', editValue: '', pendingCustomName: '' };

    default:
      return state;
  }
}

export interface SelectionResult {
  services: ServiceConfig[];
  serviceNames: string[];
  commandOverrides: Record<string, string>;
  customServices: ServiceConfig[];
}

export function resolveSelection(state: SelectorState, detected: ServiceConfig[]): SelectionResult {
  const checked = state.rows.filter((r) => r.checked);
  const services: ServiceConfig[] = checked.map((row) => {
    if (row.custom) {
      return { name: row.name, command: row.command, cwd: row.cwd, color: row.color };
    }
    return { ...detected.find((d) => d.name === row.name)!, command: row.command };
  });

  const serviceNames = checked.filter((r) => !r.custom).map((r) => r.name);
  const commandOverrides: Record<string, string> = {};
  for (const row of checked) {
    if (row.custom) continue;
    const original = detected.find((d) => d.name === row.name);
    if (original && original.command !== row.command) {
      commandOverrides[row.name] = row.command;
    }
  }
  const customServices = checked
    .filter((r) => r.custom)
    .map((row) => ({ name: row.name, command: row.command, cwd: row.cwd, color: row.color }));

  return { services, serviceNames, commandOverrides, customServices };
}
