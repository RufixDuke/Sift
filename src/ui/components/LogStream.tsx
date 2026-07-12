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
  wrapLines?: boolean;
  showTimestamps?: boolean;
}

function chunkText(text: string, chunkWidth: number): string[] {
  if (chunkWidth <= 0 || text.length === 0) return [text];
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += chunkWidth) {
    lines.push(text.slice(i, i + chunkWidth));
  }
  return lines;
}

export function LogStream({
  entries,
  selectedIndex,
  width,
  height,
  expandedIds = new Set(),
  stripAnsi = false,
  wrapLines = false,
  showTimestamps = true,
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

        const timestampPart = showTimestamps ? `${display.timestamp} ` : '';
        const left = `${timestampPart}${display.serviceTag.padEnd(10)} ${display.levelSymbol} `;
        const indent = ' '.repeat(left.length);
        const source = stripAnsi ? display.message : entry.raw;
        const firstLine = source.split('\n')[0] ?? '';
        const continuationSuffix = isMultiline && !isExpanded ? ' …' : '';

        const messageChunks = wrapLines
          ? chunkText(firstLine, Math.max(1, width - left.length))
          : [(() => {
              const available = Math.max(0, width - left.length - continuationSuffix.length);
              return firstLine.length > available
                ? firstLine.slice(0, Math.max(0, available - 1)) + '…'
                : firstLine;
            })()];

        const renderRow = (key: string, content: string, isFirst: boolean) => {
          const raw = isFirst ? `${left}${content}` : `${indent}${content}`;
          if (isSelected) {
            const padded = raw.length < width ? raw.padEnd(width) : raw;
            return (
              <Text key={key} backgroundColor={theme.selection.bg} color={theme.selection.fg} bold>
                {padded}
              </Text>
            );
          }
          return (
            <Text key={key} color={isFirst ? levelStyle.fg : theme.muted.fg} bold={isFirst && levelStyle.bold}>
              {isFirst ? (
                <>
                  {timestampPart}
                  <Text color={theme.muted.fg}>{display.serviceTag.padEnd(10)}</Text>{' '}
                  {display.levelSymbol} {content}
                </>
              ) : (
                content
              )}
            </Text>
          );
        };

        return (
          <Box key={entry.id} flexDirection="column">
            {messageChunks.map((chunk, chunkIdx) => {
              const isLastChunk = chunkIdx === messageChunks.length - 1;
              const content = isLastChunk ? `${chunk}${continuationSuffix}` : chunk;
              return renderRow(`${entry.id}-${chunkIdx}`, content, chunkIdx === 0);
            })}
            {isExpanded && (
              <Box flexDirection="column" paddingLeft={isSelected ? 0 : left.length + 1}>
                {source
                  .split('\n')
                  .slice(1)
                  .map((line, lineIdx) => {
                    const chunks = wrapLines ? chunkText(line, Math.max(1, width - left.length)) : [line.slice(0, width - left.length - 3)];
                    return chunks.map((chunk, chunkIdx) => (
                      <React.Fragment key={`${lineIdx}-${chunkIdx}`}>
                        {isSelected
                          ? renderRow(`${lineIdx}-${chunkIdx}`, chunk, false)
                          : <Text color={theme.muted.fg}>{chunk}</Text>}
                      </React.Fragment>
                    ));
                  })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
