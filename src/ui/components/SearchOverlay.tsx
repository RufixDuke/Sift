import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { theme } from '../theme.js';

export interface SearchOverlayProps {
  query: string;
  onChange: (query: string) => void;
  onSubmit?: (query: string) => void;
  matchCount?: number;
  screenHeight: number;
}

const OVERLAY_HEIGHT = 3;
const RESERVED_BOTTOM_ROWS = 1;

export function SearchOverlay({
  query,
  onChange,
  onSubmit,
  matchCount = 0,
  screenHeight,
}: SearchOverlayProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      position="absolute"
      width="100%"
      marginTop={Math.max(0, screenHeight - OVERLAY_HEIGHT - RESERVED_BOTTOM_ROWS)}
      height={OVERLAY_HEIGHT}
      paddingX={1}
    >
      <Box flexDirection="row">
        <Text color={theme.statusBar.fg}>Search: </Text>
        <TextInput
          value={query}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="type to filter..."
          showCursor
        />
        {query && (
          <Text color={theme.muted.fg}>
            {' '}
            {matchCount} match{matchCount !== 1 ? 'es' : ''}
          </Text>
        )}
      </Box>
      <Text color={theme.muted.fg}>Enter to search, Esc to close, n/N for next/prev</Text>
    </Box>
  );
}
