export const fontFamilies = {
  heading: 'CinzelDecorative-Regular',
  body: 'Cinzel-Regular',
} as const;

export const typography = {
  display: { fontFamily: fontFamilies.heading, fontSize: 48, fontWeight: '400' as const, letterSpacing: 4 },
  h1: { fontFamily: fontFamilies.heading, fontSize: 32, fontWeight: '400' as const, letterSpacing: 1 },
  h2: { fontFamily: fontFamilies.heading, fontSize: 24, fontWeight: '400' as const },
  h3: { fontFamily: fontFamilies.heading, fontSize: 18, fontWeight: '400' as const },
  body: { fontFamily: fontFamilies.body, fontSize: 16, fontWeight: '400' as const },
  caption: { fontFamily: fontFamilies.body, fontSize: 13, fontWeight: '400' as const },
  tagline: { fontFamily: fontFamilies.heading, fontSize: 14, fontWeight: '400' as const, letterSpacing: 6 },
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
