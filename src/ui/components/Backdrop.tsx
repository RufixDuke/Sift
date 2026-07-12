import React from 'react';
import { Box, Text } from 'ink';

export interface BackdropProps {
  width: number;
  height: number;
  backgroundColor: string;
}

// Ink's Box only lays out children with Yoga; it never paints backgroundColor
// onto empty cells (only Text does, via chalk). To actually blank out what's
// underneath an overlay we have to render real space-filled Text rows.
export function Backdrop({ width, height, backgroundColor }: BackdropProps): React.ReactElement {
  const line = ' '.repeat(Math.max(0, width));
  return (
    <Box position="absolute" top={0} left={0} flexDirection="column">
      {Array.from({ length: Math.max(0, height) }, (_, i) => (
        <Text key={i} backgroundColor={backgroundColor}>{line}</Text>
      ))}
    </Box>
  );
}
