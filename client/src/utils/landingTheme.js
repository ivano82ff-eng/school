/** Map theme tokens → CSS variables for landing pages */
export function themeCssVars(tokens = {}) {
  return {
    '--lp-bg': tokens.bg || '#F5F7FA',
    '--lp-surface': tokens.surface || '#FFFFFF',
    '--lp-text': tokens.text || '#2C3E50',
    '--lp-muted': tokens.muted || '#6B7C93',
    '--lp-primary': tokens.primary || '#8E6FAF',
    '--lp-primary-text': tokens.primaryText || '#FFFFFF',
    '--lp-accent': tokens.accent || '#27AE60',
    '--lp-hero-bg': tokens.heroBg || tokens.primary || '#8E6FAF',
    '--lp-hero-text': tokens.heroText || '#FFFFFF',
    '--lp-radius': tokens.radius || '16px',
    '--lp-font': tokens.font || 'system-ui, sans-serif',
    '--lp-btn-radius': tokens.buttonRadius || '12px',
  };
}
