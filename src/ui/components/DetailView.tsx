import React from 'react';
import { Box, Text } from 'ink';
import type { ParsedLogEntry } from '../../types/index.js';
import { theme } from '../theme.js';

export interface DetailViewProps {
  entry: ParsedLogEntry;
  width: number;
  height: number;
}

export function DetailView({ entry, width, height }: DetailViewProps): React.ReactElement {
  const lines = [
    `ID:        ${entry.id}`,
    `Service:   ${entry.service}`,
    `Stream:    ${entry.stream}`,
    `Timestamp: ${entry.timestamp?.toISOString() ?? 'inferred'}`,
    `Level:     ${entry.level}`,
    `Request:   ${entry.requestId ?? '-'}`,
    `Message:`,
    ...entry.message.split('\n'),
  ];

  const visible = lines.slice(0, height - 4);

  return (
    <Box
      flexDirection="column"
      position="absolute"
      alignSelf="center"
      marginTop={2}
      width="80%"
      height={height}
      borderStyle="round"
      borderColor={theme.border.fg}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={theme.sidebar.fg}>
        Log Detail
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((line, idx) => {
          if (line.startsWith('Message:')) {
            return (
              <Text key={idx} bold color={theme.sidebar.fg}>
                {line}
              </Text>
            );
          }
          return (
            <Text key={idx} color={theme.sidebar.fg}>
              {line.slice(0, width - 6)}
            </Text>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.muted.fg}>Press Esc or d to close</Text>
      </Box>
    </Box>
  );
}
