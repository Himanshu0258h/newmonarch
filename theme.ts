export const theme = {
  colors: {
    background: '#F4F4F5',
    sheet: '#FFFFFF',
    headerStart: '#5C0000',
    headerMid1: '#B3200A',
    headerMid2: '#E8470F',
    headerMid3: '#F07A2A',
    headerEnd: '#F2A25C',
    pill: '#F1F1F2',
    muted: '#8E8E93',
    text: '#111111',
    primary: '#111111',
    cardTint: 'rgba(255,255,255,0.25)',
    white: '#FFFFFF',
    danger: '#E0565B',
    success: '#1BAA6B',
    purple: '#6F4CFF',
    shadow: 'rgba(17, 17, 17, 0.12)',
    notification: '#F4C24D',
    info: '#A1A1A9',
  },
  radii: {
    sheet: 40,
    header: 40,
    pill: 999,
    icon: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 30,
    giant: 36,
  },
  typography: {
    h1: {
      fontSize: 64,
      fontWeight: '500' as const,
      letterSpacing: -2,
      lineHeight: 64,
    },
    h2: {
      fontSize: 26,
      fontWeight: '700' as const,
      letterSpacing: -0.8,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '500' as const,
      letterSpacing: -0.3,
    },
    body: {
      fontSize: 16,
      fontWeight: '500' as const,
      letterSpacing: -0.2,
    },
    label: {
      fontSize: 15,
      fontWeight: '500' as const,
      letterSpacing: -0.2,
    },
    small: {
      fontSize: 14,
      fontWeight: '500' as const,
      letterSpacing: -0.2,
    },
  },
};

export default theme;
