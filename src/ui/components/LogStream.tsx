import React from 'react';
import { Box, Text } from 'ink';
import type { ParsedLogEntry } from '../../types/index.js';
import { theme } from '../theme.js';

export interface LogStreamProps {
  entries: ParsedLogEntry[];
  selectedIndex: number;
  width: number;
  height: number;
  expandedIds?: Set<number>;
  stripAnsi?: boolean;
}

export function LogStream({
  entries,
  selectedIndex,
  width,
  height,
  expandedIds = new Set(),
  stripAnsi = false,
}: LogStreamProps): React.ReactElement {
  const visibleCount = Math.max(0, height - 1);
  const endIndex = Math.max(0, entries.length - 1);
  const cursor = Math.min(selectedIndex, endIndex);

  let start = Math.max(0, entries.length - visibleCount);
  if (cursor < start) start = cursor;
  if (cursor >= start + visibleCount) start = cursor - visibleCount + 1;

  const visible = entries.slice(start, start + visibleCount);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {visible.map((entry, idx) => {
        const isSelected = start + idx === cursor;
        const display = entry.display;
        const levelStyle = theme.levels[entry.level];
        const isExpanded = expandedIds.has(entry.id);
        const isMultiline = entry.message.includes('\n');

        const left = `${display.timestamp} ${display.serviceTag.padEnd(10)} ${display.levelSymbol} `;
        const available = Math.max(0, width - left.length - 3);
        const source = stripAnsi ? display.message : entry.raw;
        const firstLine = source.split('\n')[0] ?? '';
        const message = firstLine.length > available
          ? firstLine.slice(0, available - 1) + '…'
          : firstLine;

        return (
          <Box key={entry.id} flexDirection="column">
            <Box>
              {isSelected && <Text backgroundColor={theme.selection.bg}>{' '}</Text>}
              <Text color={levelStyle.fg} bold={levelStyle.bold}>
                {display.timestamp} <Text color={theme.muted.fg}>{display.serviceTag.padEnd(10)}</Text>{' '}
                {display.levelSymbol} {message}
                {isMultiline && !isExpanded && <Text color={theme.muted.fg}> …</Text>}
              </Text>
            </Box>
            {isExpanded && (
              <Box flexDirection="column" paddingLeft={left.length + 1}>
                {source
                  .split('\n')
                  .slice(1)
                  .map((line, lineIdx) => (
                    <Text key={lineIdx} color={theme.muted.fg}>{line.slice(0, width - left.length - 3)}</Text>
                  ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
