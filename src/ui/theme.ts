export const theme = {
  services: [
    '#00BCD4',
    '#2196F3',
    '#9C27B0',
    '#FF9800',
    '#607D8B',
    '#E91E63',
    '#3F51B5',
    '#795548',
    '#009688',
    '#FFC107',
  ],
  levels: {
    error: { fg: '#F44336', bg: '#3A1A1A', bold: true, symbol: '✗' },
    warn: { fg: '#FF9800', bg: '#3A2A0A', bold: false, symbol: '⚠' },
    info: { fg: '#E0E0E0', bg: undefined, bold: false, symbol: 'ℹ' },
    debug: { fg: '#90A4AE', bg: undefined, bold: false, symbol: '◆' },
    trace: { fg: '#78909C', bg: undefined, bold: false, symbol: '···' },
    unknown: { fg: '#B0BEC5', bg: undefined, bold: false, symbol: '?' },
  },
  sidebar: { fg: '#E0E0E0', bg: '#263238' },
  statusBar: { fg: '#FFFFFF', bg: '#37474F' },
  statusError: { fg: '#FFFFFF', bg: '#D32F2F' },
  statusWarn: { fg: '#000000', bg: '#FBC02D' },
  highlight: { fg: '#212121', bg: '#FFEB3B' },
  selection: { fg: '#FFFFFF', bg: '#1565C0' },
  border: { fg: '#455A64' },
  muted: { fg: '#78909C' },
};

export function hexToChalk(hex: string): string {
  return hex;
}
