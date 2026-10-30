/**
 * Global color schemes — single source of truth.
 * Extend `schemes` / `brand` here; Ant Design + CSS vars pick them up automatically.
 *
 * Light palette (product spec):
 * - bg #F5F7FA, surface #FFFFFF, accent #8E6FAF, text #2C3E50
 * Violet is accent only — contrast comes from dark text on light bg.
 */

export const THEME_STORAGE_KEY = 'itscool_theme_mode';

/** Brand accents */
export const brand = {
  violet: '#8E6FAF',
  violetHover: '#7B5FA0',
  violetSoft: 'rgba(142, 111, 175, 0.12)',
  violetSofter: 'rgba(142, 111, 175, 0.08)',
  violetMuted: '#A892C4',
  violetDeep: '#6A5285',
};

export const semantic = {
  success: '#27AE60',
  successSoft: 'rgba(39, 174, 96, 0.12)',
  error: '#C0392B',
  errorSoft: 'rgba(192, 57, 43, 0.12)',
  warning: '#D68910',
  warningSoft: 'rgba(214, 137, 16, 0.12)',
};

/**
 * Mode palettes. Add e.g. `highContrast` by copying a block + wiring ThemeProvider.
 */
export const schemes = {
  light: {
    id: 'light',
    label: 'Светлая',
    bg: '#F5F7FA',
    bgSubtle: '#EEF1F5',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    border: '#E0E4E8',
    borderStrong: '#D0D5DB',
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    textMuted: '#95A5A6',
    primary: brand.violet,
    primaryHover: brand.violetHover,
    primarySoft: brand.violetSoft,
    accent: brand.violet,
    accentSoft: brand.violetSofter,
    headerBg: 'rgba(245, 247, 250, 0.94)',
    heroFrom: brand.violet,
    heroTo: brand.violetMuted,
    glow: 'rgba(142, 111, 175, 0.14)',
    glowAlt: 'rgba(142, 111, 175, 0.08)',
    selection: brand.violetSoft,
    codeBg: '#2C3E50',
    codeText: '#F5F7FA',
    success: semantic.success,
    warning: semantic.warning,
    error: semantic.error,
    btnPrimaryText: '#FFFFFF',
    btnSecondaryBg: '#FFFFFF',
    btnSecondaryBorder: brand.violet,
    btnSecondaryText: brand.violet,
  },
  dark: {
    id: 'dark',
    label: 'Тёмная',
    // Neutral dark surfaces; same soft violet as accent
    bg: '#1A1D23',
    bgSubtle: '#22262E',
    surface: '#252A33',
    elevated: '#2E3440',
    border: '#3A4150',
    borderStrong: '#4A5263',
    text: '#F5F7FA',
    textSecondary: '#A8B0B8',
    textMuted: '#7F8C8D',
    primary: brand.violetMuted,
    primaryHover: brand.violet,
    primarySoft: 'rgba(168, 146, 196, 0.16)',
    accent: brand.violetMuted,
    accentSoft: 'rgba(142, 111, 175, 0.14)',
    headerBg: 'rgba(37, 42, 51, 0.94)',
    heroFrom: brand.violetDeep,
    heroTo: brand.violet,
    glow: 'rgba(142, 111, 175, 0.16)',
    glowAlt: 'rgba(168, 146, 196, 0.1)',
    selection: 'rgba(142, 111, 175, 0.18)',
    codeBg: '#12151A',
    codeText: '#E8ECF0',
    success: '#2ECC71',
    warning: '#F39C12',
    error: '#E74C3C',
    btnPrimaryText: '#FFFFFF',
    btnSecondaryBg: 'transparent',
    btnSecondaryBorder: brand.violetMuted,
    btnSecondaryText: brand.violetMuted,
  },
};

export function getScheme(mode) {
  return schemes[mode] || schemes.light;
}

/** Apply CSS custom properties for app chrome / custom CSS */
export function applyCssVars(mode) {
  const s = getScheme(mode);
  const root = document.documentElement;
  root.dataset.theme = mode;
  const map = {
    '--color-bg': s.bg,
    '--color-bg-subtle': s.bgSubtle,
    '--color-surface': s.surface,
    '--color-elevated': s.elevated,
    '--color-border': s.border,
    '--color-border-strong': s.borderStrong,
    '--color-text': s.text,
    '--color-text-secondary': s.textSecondary,
    '--color-text-muted': s.textMuted,
    '--color-primary': s.primary,
    '--color-primary-hover': s.primaryHover,
    '--color-primary-soft': s.primarySoft,
    '--color-accent': s.accent,
    '--color-accent-soft': s.accentSoft,
    '--color-header-bg': s.headerBg,
    '--color-hero-from': s.heroFrom,
    '--color-hero-to': s.heroTo,
    '--color-glow': s.glow,
    '--color-glow-alt': s.glowAlt,
    '--color-selection': s.selection,
    '--color-code-bg': s.codeBg,
    '--color-code-text': s.codeText,
    '--color-success': s.success,
    '--color-warning': s.warning,
    '--color-error': s.error,
    '--color-btn-primary-text': s.btnPrimaryText,
    '--color-btn-secondary-bg': s.btnSecondaryBg,
    '--color-btn-secondary-border': s.btnSecondaryBorder,
    '--color-btn-secondary-text': s.btnSecondaryText,
  };
  for (const [key, value] of Object.entries(map)) {
    root.style.setProperty(key, value);
  }
}

export function readStoredMode() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // ignore
  }
  return 'light';
}
