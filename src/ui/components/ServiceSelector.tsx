import React, { useReducer } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import type { ServiceConfig } from '../../types/index.js';
import type { LastRunEntry } from '../../core/lastRun.js';
import {
  initSelectorState,
  reduceSelectorState,
  resolveSelection,
  addRowIndex,
  type SelectionResult,
} from '../../core/selectorState.js';
import { theme } from '../theme.js';

export interface ServiceSelectorProps {
  detected: ServiceConfig[];
  lastRun?: LastRunEntry;
  onConfirm: (result: SelectionResult) => void;
  onCancel: () => void;
}

export function ServiceSelector({
  detected,
  lastRun,
  onConfirm,
  onCancel,
}: ServiceSelectorProps): React.ReactElement {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(reduceSelectorState, initSelectorState(detected, lastRun));

  useInput((input, key) => {
    if (state.mode === 'editCommand' || state.mode === 'addName' || state.mode === 'addCommand') {
      if (key.escape) dispatch({ type: 'CANCEL_EDIT' });
      return;
    }

    if (key.escape || input === 'q') {
      onCancel();
      exit();
      return;
    }

    if (key.upArrow) {
      dispatch({ type: 'MOVE_UP' });
    } else if (key.downArrow) {
      dispatch({ type: 'MOVE_DOWN' });
    } else if (input === ' ') {
      dispatch({ type: 'TOGGLE' });
    } else if (key.return) {
      dispatch({ type: 'START_EDIT' });
    } else if (input === 'a') {
      dispatch({ type: 'FOCUS_ADD_ROW' });
      dispatch({ type: 'START_EDIT' });
    } else if (input === 'r') {
      const checkedCount = state.rows.filter((r) => r.checked).length;
      if (checkedCount === 0) return;
      onConfirm(resolveSelection(state, detected));
      exit();
    }
  });

  const isAddRow: boolean = state.cursor === addRowIndex(state);
  const checkedCount = state.rows.filter((r) => r.checked).length;

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color={theme.sidebar.fg}>
        Detected {detected.length} service{detected.length !== 1 ? 's' : ''} — select which to run:
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {state.rows.map((row, idx) => {
          const isSelected = idx === state.cursor && state.mode === 'list';
          const isEditingThis = idx === state.cursor && state.mode === 'editCommand';
          const box = row.checked ? '[x]' : '[ ]';
          return (
            <Box key={`${row.name}-${idx}`} flexDirection="row">
              <Text color={isSelected ? theme.selection.bg : undefined} inverse={isSelected}>
                {box} {row.name.padEnd(12)}{' '}
              </Text>
              {isEditingThis ? (
                <TextInput
                  value={state.editValue}
                  onChange={(value) => dispatch({ type: 'CHANGE_EDIT_VALUE', value })}
                  onSubmit={() => dispatch({ type: 'SUBMIT_EDIT' })}
                  showCursor
                />
              ) : (
                <Text color={row.guessed ? theme.statusWarn.bg : theme.muted.fg}>
                  {row.command}
                  {row.guessed ? '  (guess — edit before running)' : ''}
                </Text>
              )}
            </Box>
          );
        })}

        <Box flexDirection="row">
          <Text inverse={isAddRow && state.mode === 'list'}>
            {state.mode === 'addName' || state.mode === 'addCommand'
              ? ''
              : '[+] Add a custom command...'}
          </Text>
          {state.mode === 'addName' && (
            <Box flexDirection="row">
              <Text>Name: </Text>
              <TextInput
                value={state.editValue}
                onChange={(value) => dispatch({ type: 'CHANGE_EDIT_VALUE', value })}
                onSubmit={() => dispatch({ type: 'SUBMIT_EDIT' })}
                showCursor
              />
            </Box>
          )}
          {state.mode === 'addCommand' && (
            <Box flexDirection="row">
              <Text>{state.pendingCustomName} command: </Text>
              <TextInput
                value={state.editValue}
                onChange={(value) => dispatch({ type: 'CHANGE_EDIT_VALUE', value })}
                onSubmit={() => dispatch({ type: 'SUBMIT_EDIT' })}
                showCursor
              />
            </Box>
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.muted.fg}>
          ↑/↓ move space toggle enter edit/add esc cancel edit a add custom r run selected q quit
        </Text>
      </Box>
      <Box>
        <Text color={checkedCount === 0 ? theme.statusError.bg : theme.muted.fg}>
          {checkedCount} service{checkedCount !== 1 ? 's' : ''} selected
          {checkedCount === 0 ? ' — select at least one to run' : ''}
        </Text>
      </Box>
    </Box>
  );
}
