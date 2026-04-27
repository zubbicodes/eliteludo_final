export const colors = {
  bg: '#0A0A0A',
  bgElevated: '#141414',
  surface: '#1C1C1E',
  card: '#1C1C1E',
  border: '#2A2A2E',

  gold: '#D4AF37',
  goldLight: '#F1C84B',
  goldDark: '#A88A2C',

  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.65)',
  textDim: 'rgba(255, 255, 255, 0.4)',

  green: '#3DB45A',
  yellow: '#F0C419',
  red: '#E2574C',
  blue: '#3F92D2',

  danger: '#E2574C',
  success: '#3DB45A',
  
  gray: '#888888',
  white: '#FFFFFF',
} as const;

export type ColorToken = keyof typeof colors;
