import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';

const SHORTCUTS = [
  ['↑ / ↓', 'Scroll logs (1 line)'],
  ['PgUp / PgDn', 'Scroll (10 lines)'],
  ['Space', 'Pause / resume stream'],
  ['/', 'Open search overlay'],
  ['n / N', 'Next / previous search match'],
  ['e', 'Filter errors'],
  ['w', 'Filter warnings'],
  ['i', 'Filter info'],
  ['a', 'Show all levels / services'],
  ['s then 1-9', 'Toggle service visibility (hide/show)'],
  ['1 … 9', 'Show only that service (press again for all)'],
  ['Enter', 'Expand multi-line log / show trace'],
  ['Backspace / Esc', 'Close overlay / return to full view'],
  ['d', 'Show detail view for selected log'],
  ['c', 'Copy selected log to clipboard'],
  ['r', 'Restart selected service'],
  ['l', 'Toggle line wrapping'],
  ['t', 'Toggle timestamps'],
  ['h / ?', 'Show help overlay'],
  ['q / Ctrl+C', 'Quit Sift'],
];

export function HelpOverlay(): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      position="absolute"
      alignSelf="center"
      marginTop={2}
      width="60%"
      height={24}
      borderStyle="round"
      borderColor={theme.border.fg}
      paddingX={2}
      paddingY={1}
    >
      <Text bold underline color={theme.sidebar.fg}>
        Keyboard Shortcuts
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {SHORTCUTS.map(([key, desc]) => (
          <Box key={key} flexDirection="row">
            <Box width={18}>
              <Text color={theme.highlight.bg}>{key}</Text>
            </Box>
            <Text color={theme.sidebar.fg}>{desc}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.muted.fg}>Press Esc or ? to close</Text>
      </Box>
    </Box>
  );
}
