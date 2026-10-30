/**
 * Marketing landings: themes, block catalog, helpers.
 */

const { slugify, uniqueSlug, parseJson } = require('./content');

const LANDING_BLOCK_TYPES = [
  { type: 'hero', label: 'Hero / шапка', category: 'layout' },
  { type: 'heading', label: 'Заголовок', category: 'content' },
  { type: 'text', label: 'Текст', category: 'content' },
  { type: 'markdown', label: 'Markdown', category: 'content' },
  { type: 'image', label: 'Картинка', category: 'media' },
  { type: 'video', label: 'Видео', category: 'media' },
  { type: 'gallery', label: 'Галерея', category: 'media' },
  { type: 'features', label: 'Преимущества', category: 'content' },
  { type: 'pricing', label: 'Тарифы / акция', category: 'promo' },
  { type: 'countdown', label: 'Таймер акции', category: 'promo' },
  { type: 'cta_form', label: 'Форма заявки', category: 'lead' },
  { type: 'cta_button', label: 'Кнопка CTA', category: 'lead' },
  { type: 'trial_teaser', label: 'Пробный контент', category: 'promo' },
  { type: 'survey', label: 'Опрос', category: 'engage' },
  { type: 'quiz_game', label: 'Гейм-квиз', category: 'engage' },
  { type: 'points_bar', label: 'Очки / прогресс', category: 'engage' },
  { type: 'leaderboard', label: 'Рейтинг', category: 'engage' },
  { type: 'faq', label: 'FAQ', category: 'content' },
  { type: 'testimonials', label: 'Отзывы', category: 'content' },
  { type: 'embed', label: 'Embed / HTML', category: 'media' },
  { type: 'divider', label: 'Разделитель', category: 'layout' },
  { type: 'spacer', label: 'Отступ', category: 'layout' },
];

const DEFAULT_THEMES = [
  {
    code: 'violet-school',
    name: 'Школьный фиолет',
    tokens_json: JSON.stringify({
      bg: '#F5F7FA',
      surface: '#FFFFFF',
      text: '#2C3E50',
      muted: '#6B7C93',
      primary: '#8E6FAF',
      primaryText: '#FFFFFF',
      accent: '#27AE60',
      heroBg: 'linear-gradient(135deg, #8E6FAF 0%, #6A5285 100%)',
      heroText: '#FFFFFF',
      radius: '16px',
      font: '"Segoe UI", system-ui, sans-serif',
      buttonRadius: '12px',
    }),
  },
  {
    code: 'ocean',
    name: 'Океан',
    tokens_json: JSON.stringify({
      bg: '#E8F4FC',
      surface: '#FFFFFF',
      text: '#0F2C4C',
      muted: '#5A7A94',
      primary: '#1F7A8C',
      primaryText: '#FFFFFF',
      accent: '#E09F3E',
      heroBg: 'linear-gradient(120deg, #1F7A8C 0%, #022B3A 100%)',
      heroText: '#FFFFFF',
      radius: '8px',
      font: 'Georgia, "Times New Roman", serif',
      buttonRadius: '4px',
    }),
  },
  {
    code: 'sunset',
    name: 'Закат',
    tokens_json: JSON.stringify({
      bg: '#FFF8F0',
      surface: '#FFFFFF',
      text: '#3D2C29',
      muted: '#8A6E68',
      primary: '#E07A5F',
      primaryText: '#FFFFFF',
      accent: '#3D405B',
      heroBg: 'linear-gradient(135deg, #E07A5F 0%, #F2CC8F 100%)',
      heroText: '#3D2C29',
      radius: '24px',
      font: '"Trebuchet MS", sans-serif',
      buttonRadius: '999px',
    }),
  },
  {
    code: 'mint',
    name: 'Мята',
    tokens_json: JSON.stringify({
      bg: '#F0FAF6',
      surface: '#FFFFFF',
      text: '#1B4332',
      muted: '#52796F',
      primary: '#2D6A4F',
      primaryText: '#FFFFFF',
      accent: '#95D5B2',
      heroBg: 'linear-gradient(160deg, #2D6A4F 0%, #52B788 100%)',
      heroText: '#FFFFFF',
      radius: '12px',
      font: 'Verdana, Geneva, sans-serif',
      buttonRadius: '10px',
    }),
  },
  {
    code: 'contrast',
    name: 'Контраст',
    tokens_json: JSON.stringify({
      bg: '#111111',
      surface: '#1C1C1C',
      text: '#F5F5F5',
      muted: '#A0A0A0',
      primary: '#FFD60A',
      primaryText: '#111111',
      accent: '#4CC9F0',
      heroBg: 'linear-gradient(180deg, #111 0%, #2B2B2B 100%)',
      heroText: '#FFFFFF',
      radius: '4px',
      font: '"Courier New", monospace',
      buttonRadius: '0px',
    }),
  },
];

function pageSlugExists(db, slug, exceptId = null) {
  if (exceptId) {
    return !!db
      .prepare('SELECT 1 FROM landing_pages WHERE slug = ? AND id != ?')
      .get(slug, exceptId);
  }
  return !!db.prepare('SELECT 1 FROM landing_pages WHERE slug = ?').get(slug);
}

function blockSlugExists(db, pageId, slug, exceptId = null) {
  if (exceptId) {
    return !!db
      .prepare('SELECT 1 FROM landing_blocks WHERE page_id = ? AND slug = ? AND id != ?')
      .get(pageId, slug, exceptId);
  }
  return !!db
    .prepare('SELECT 1 FROM landing_blocks WHERE page_id = ? AND slug = ?')
    .get(pageId, slug);
}

function serializeBlock(row) {
  if (!row) return null;
  return {
    ...row,
    config: parseJson(row.config_json, {}),
    visible: row.visible !== 0,
  };
}

function serializePage(row, theme = null) {
  if (!row) return null;
  return {
    ...row,
    settings: parseJson(row.settings_json, {}),
    theme: theme
      ? {
          ...theme,
          tokens: parseJson(theme.tokens_json, {}),
        }
      : null,
  };
}

function themeCssVars(tokens = {}) {
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

module.exports = {
  LANDING_BLOCK_TYPES,
  DEFAULT_THEMES,
  slugify,
  uniqueSlug,
  parseJson,
  pageSlugExists,
  blockSlugExists,
  serializeBlock,
  serializePage,
  themeCssVars,
};
