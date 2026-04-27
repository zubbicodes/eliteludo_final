export const typography = {
  display: { fontSize: 48, fontWeight: '800' as const, letterSpacing: 4 },
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: 1 },
  h2: { fontSize: 24, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  tagline: { fontSize: 14, fontWeight: '500' as const, letterSpacing: 6 },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;
