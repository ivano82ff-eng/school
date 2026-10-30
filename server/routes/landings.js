const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const {
  LANDING_BLOCK_TYPES,
  slugify,
  uniqueSlug,
  parseJson,
  pageSlugExists,
  blockSlugExists,
  serializeBlock,
  serializePage,
} = require('../services/landings');

const router = express.Router();
const staff = [authRequired, requirePermission('marketing.landings')];
const analytics = [authRequired, requirePermission('marketing.analytics', 'marketing.landings')];

function getTheme(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM landing_themes WHERE id = ?').get(id);
}

function loadPage(id) {
  const page = db.prepare('SELECT * FROM landing_pages WHERE id = ?').get(id);
  if (!page) return null;
  const theme = getTheme(page.theme_id);
  const blocks = db
    .prepare(
      `SELECT * FROM landing_blocks WHERE page_id = ? ORDER BY sort_order, id`
    )
    .all(id)
    .map(serializeBlock);
  return { page: serializePage(page, theme), blocks };
}

function trackEvent({ page_id, block_id, session_id, event_type, meta, lead_id }) {
  db.prepare(
    `INSERT INTO landing_events (page_id, block_id, session_id, event_type, meta_json, lead_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    page_id,
    block_id || null,
    session_id || null,
    event_type,
    JSON.stringify(meta || {}),
    lead_id || null
  );
}

/* ——— catalog ——— */
router.get('/meta', ...staff, (_req, res) => {
  const themes = db
    .prepare('SELECT * FROM landing_themes ORDER BY is_system DESC, name')
    .all()
    .map((t) => ({ ...t, tokens: parseJson(t.tokens_json, {}) }));
  res.json({ block_types: LANDING_BLOCK_TYPES, themes });
});

router.get('/', ...staff, (_req, res) => {
  const pages = db
    .prepare(
      `SELECT p.*, t.name as theme_name, t.code as theme_code,
        (SELECT COUNT(*) FROM landing_blocks b WHERE b.page_id = p.id) as blocks_count,
        (SELECT COUNT(*) FROM landing_events e WHERE e.page_id = p.id AND e.event_type = 'view') as views,
        (SELECT COUNT(*) FROM leads l WHERE l.landing_page_id = p.id) as leads_count
       FROM landing_pages p
       LEFT JOIN landing_themes t ON t.id = p.theme_id
       ORDER BY p.updated_at DESC`
    )
    .all();
  res.json({ pages });
});

router.post('/', ...staff, (req, res) => {
  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Укажите название' });
  const slug = uniqueSlug(req.body?.slug || title, (s) => pageSlugExists(db, s));
  const theme_id = req.body?.theme_id ? Number(req.body.theme_id) : null;
  const settings_json = JSON.stringify(req.body?.settings || {});

  const id = db
    .prepare(
      `INSERT INTO landing_pages (slug, title, status, theme_id, settings_json, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?)`
    )
    .run(slug, title, theme_id, settings_json, req.user.id).lastInsertRowid;

  // Starter hero + CTA
  const heroSlug = uniqueSlug('hero', (s) => blockSlugExists(db, id, s));
  db.prepare(
    `INSERT INTO landing_blocks (page_id, type, title, slug, content, config_json, sort_order)
     VALUES (?, 'hero', ?, ?, ?, ?, 0)`
  ).run(
    id,
    title,
    heroSlug,
    'IT-курсы для школьников 1–11 классов',
    JSON.stringify({
      subtitle: 'Пробный урок и персональный план обучения',
      ctaLabel: 'Записаться',
      ctaTarget: 'form',
    })
  );
  const formSlug = uniqueSlug('zayavka', (s) => blockSlugExists(db, id, s));
  db.prepare(
    `INSERT INTO landing_blocks (page_id, type, title, slug, content, config_json, sort_order)
     VALUES (?, 'cta_form', ?, ?, ?, ?, 10)`
  ).run(
    id,
    'Оставить заявку',
    formSlug,
    '',
    JSON.stringify({
      interestDefault: 'Python',
      successText: 'Спасибо! Мы свяжемся и предложим пробный урок.',
      gamifyPoints: 50,
    })
  );

  res.status(201).json(loadPage(id));
});

router.get('/:id', ...staff, (req, res) => {
  const data = loadPage(req.params.id);
  if (!data) return res.status(404).json({ error: 'Лендинг не найден' });
  res.json(data);
});

router.patch('/:id', ...staff, (req, res) => {
  const page = db.prepare('SELECT * FROM landing_pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Лендинг не найден' });

  const title = req.body.title != null ? String(req.body.title).trim() : page.title;
  let slug = page.slug;
  if (req.body.slug != null) {
    slug = uniqueSlug(req.body.slug, (s) => pageSlugExists(db, s, page.id));
  }
  const theme_id =
    req.body.theme_id !== undefined
      ? req.body.theme_id
        ? Number(req.body.theme_id)
        : null
      : page.theme_id;
  const settings_json =
    req.body.settings != null
      ? JSON.stringify(req.body.settings)
      : page.settings_json;
  let status = page.status;
  let published_at = page.published_at;
  if (req.body.status && ['draft', 'published', 'archived'].includes(req.body.status)) {
    status = req.body.status;
    if (status === 'published' && !published_at) {
      published_at = new Date().toISOString();
    }
  }

  db.prepare(
    `UPDATE landing_pages
     SET title=?, slug=?, theme_id=?, settings_json=?, status=?, published_at=?,
         updated_at=datetime('now')
     WHERE id=?`
  ).run(title, slug, theme_id, settings_json, status, published_at, page.id);

  res.json(loadPage(page.id));
});

router.delete('/:id', ...staff, (req, res) => {
  const info = db.prepare('DELETE FROM landing_pages WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Лендинг не найден' });
  res.json({ ok: true });
});

router.post('/:id/duplicate', ...staff, (req, res) => {
  const data = loadPage(req.params.id);
  if (!data) return res.status(404).json({ error: 'Лендинг не найден' });
  const title = `${data.page.title} (копия)`;
  const slug = uniqueSlug(data.page.slug + '-copy', (s) => pageSlugExists(db, s));
  const id = db
    .prepare(
      `INSERT INTO landing_pages (slug, title, status, theme_id, settings_json, created_by)
       VALUES (?, ?, 'draft', ?, ?, ?)`
    )
    .run(
      slug,
      title,
      data.page.theme_id,
      data.page.settings_json || '{}',
      req.user.id
    ).lastInsertRowid;

  const ins = db.prepare(
    `INSERT INTO landing_blocks (page_id, type, title, slug, content, config_json, sort_order, visible)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const b of data.blocks) {
    const bslug = uniqueSlug(b.slug, (s) => blockSlugExists(db, id, s));
    ins.run(
      id,
      b.type,
      b.title,
      bslug,
      b.content,
      JSON.stringify(b.config || {}),
      b.sort_order,
      b.visible ? 1 : 0
    );
  }
  res.status(201).json(loadPage(id));
});

/* ——— blocks ——— */
router.post('/:id/blocks', ...staff, (req, res) => {
  const page = db.prepare('SELECT * FROM landing_pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Лендинг не найден' });
  const type = (req.body?.type || 'text').trim();
  const title = (req.body?.title || type).trim();
  const slug = uniqueSlug(req.body?.slug || title || type, (s) =>
    blockSlugExists(db, page.id, s)
  );
  const maxOrder =
    db
      .prepare('SELECT COALESCE(MAX(sort_order), -10) as m FROM landing_blocks WHERE page_id = ?')
      .get(page.id).m + 10;

  const id = db
    .prepare(
      `INSERT INTO landing_blocks (page_id, type, title, slug, content, config_json, sort_order, visible)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      page.id,
      type,
      title,
      slug,
      req.body?.content || '',
      JSON.stringify(req.body?.config || {}),
      req.body?.sort_order != null ? Number(req.body.sort_order) : maxOrder
    ).lastInsertRowid;

  db.prepare(`UPDATE landing_pages SET updated_at=datetime('now') WHERE id=?`).run(page.id);
  res.status(201).json({
    block: serializeBlock(db.prepare('SELECT * FROM landing_blocks WHERE id = ?').get(id)),
  });
});

router.patch('/blocks/:blockId', ...staff, (req, res) => {
  const block = db.prepare('SELECT * FROM landing_blocks WHERE id = ?').get(req.params.blockId);
  if (!block) return res.status(404).json({ error: 'Блок не найден' });

  const title = req.body.title != null ? String(req.body.title) : block.title;
  let slug = block.slug;
  if (req.body.slug != null) {
    slug = uniqueSlug(req.body.slug, (s) => blockSlugExists(db, block.page_id, s, block.id));
  }
  const type = req.body.type != null ? String(req.body.type) : block.type;
  const content = req.body.content != null ? String(req.body.content) : block.content;
  const config_json =
    req.body.config != null ? JSON.stringify(req.body.config) : block.config_json;
  const visible =
    req.body.visible !== undefined ? (req.body.visible ? 1 : 0) : block.visible;
  const sort_order =
    req.body.sort_order != null ? Number(req.body.sort_order) : block.sort_order;

  db.prepare(
    `UPDATE landing_blocks
     SET type=?, title=?, slug=?, content=?, config_json=?, visible=?, sort_order=?
     WHERE id=?`
  ).run(type, title, slug, content, config_json, visible, sort_order, block.id);

  db.prepare(`UPDATE landing_pages SET updated_at=datetime('now') WHERE id=?`).run(block.page_id);
  res.json({
    block: serializeBlock(db.prepare('SELECT * FROM landing_blocks WHERE id = ?').get(block.id)),
  });
});

router.delete('/blocks/:blockId', ...staff, (req, res) => {
  const block = db.prepare('SELECT * FROM landing_blocks WHERE id = ?').get(req.params.blockId);
  if (!block) return res.status(404).json({ error: 'Блок не найден' });
  db.prepare('DELETE FROM landing_blocks WHERE id = ?').run(block.id);
  db.prepare(`UPDATE landing_pages SET updated_at=datetime('now') WHERE id=?`).run(block.page_id);
  res.json({ ok: true });
});

router.post('/:id/blocks/reorder', ...staff, (req, res) => {
  const page = db.prepare('SELECT * FROM landing_pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Лендинг не найден' });
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const upd = db.prepare('UPDATE landing_blocks SET sort_order = ? WHERE id = ? AND page_id = ?');
  ids.forEach((id, i) => upd.run(i * 10, id, page.id));
  res.json(loadPage(page.id));
});

/* ——— themes ——— */
router.post('/themes/custom', ...staff, (req, res) => {
  const name = (req.body?.name || '').trim();
  const tokens = req.body?.tokens || {};
  if (!name) return res.status(400).json({ error: 'Укажите название темы' });
  const code = uniqueSlug(req.body?.code || name, (s) =>
    !!db.prepare('SELECT 1 FROM landing_themes WHERE code = ?').get(s)
  );
  const id = db
    .prepare(
      `INSERT INTO landing_themes (code, name, tokens_json, is_system) VALUES (?, ?, ?, 0)`
    )
    .run(code, name, JSON.stringify(tokens)).lastInsertRowid;
  const theme = db.prepare('SELECT * FROM landing_themes WHERE id = ?').get(id);
  res.status(201).json({ theme: { ...theme, tokens: parseJson(theme.tokens_json, {}) } });
});

router.patch('/themes/:id', ...staff, (req, res) => {
  const theme = db.prepare('SELECT * FROM landing_themes WHERE id = ?').get(req.params.id);
  if (!theme) return res.status(404).json({ error: 'Тема не найдена' });
  const name = req.body.name != null ? String(req.body.name).trim() : theme.name;
  const tokens_json =
    req.body.tokens != null ? JSON.stringify(req.body.tokens) : theme.tokens_json;
  db.prepare('UPDATE landing_themes SET name=?, tokens_json=? WHERE id=?').run(
    name,
    tokens_json,
    theme.id
  );
  const updated = db.prepare('SELECT * FROM landing_themes WHERE id = ?').get(theme.id);
  res.json({ theme: { ...updated, tokens: parseJson(updated.tokens_json, {}) } });
});

/* ——— analytics ——— */
router.get('/:id/analytics', ...analytics, (req, res) => {
  const page = db.prepare('SELECT * FROM landing_pages WHERE id = ?').get(req.params.id);
  if (!page) return res.status(404).json({ error: 'Лендинг не найден' });

  const byType = db
    .prepare(
      `SELECT event_type, COUNT(*) as c FROM landing_events WHERE page_id = ? GROUP BY event_type`
    )
    .all(page.id);
  const leads = db
    .prepare(
      `SELECT COUNT(*) as c FROM leads WHERE landing_page_id = ?`
    )
    .get(page.id).c;
  const surveys = db
    .prepare(
      `SELECT COUNT(*) as c FROM landing_survey_answers WHERE page_id = ?`
    )
    .get(page.id).c;
  const games = db
    .prepare(
      `SELECT COUNT(*) as c, COALESCE(AVG(score),0) as avg_score
       FROM landing_game_states WHERE page_id = ?`
    )
    .get(page.id);
  const recent = db
    .prepare(
      `SELECT e.*, b.title as block_title
       FROM landing_events e
       LEFT JOIN landing_blocks b ON b.id = e.block_id
       WHERE e.page_id = ?
       ORDER BY e.id DESC LIMIT 40`
    )
    .all(page.id)
    .map((e) => ({ ...e, meta: parseJson(e.meta_json, {}) }));

  const views = byType.find((x) => x.event_type === 'view')?.c || 0;
  const submits = byType.find((x) => x.event_type === 'form_submit')?.c || 0;

  res.json({
    summary: {
      views,
      form_submits: submits,
      leads,
      surveys,
      game_sessions: games.c,
      avg_game_score: Math.round(games.avg_score || 0),
      conversion: views ? Math.round((leads / views) * 1000) / 10 : 0,
    },
    byType,
    recent,
  });
});

/* ——— public ——— */
router.get('/public/:slug', (req, res) => {
  const page = db
    .prepare(`SELECT * FROM landing_pages WHERE slug = ? AND status = 'published'`)
    .get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Страница не найдена или не опубликована' });
  const theme = getTheme(page.theme_id);
  const blocks = db
    .prepare(
      `SELECT * FROM landing_blocks WHERE page_id = ? AND visible = 1 ORDER BY sort_order, id`
    )
    .all(page.id)
    .map(serializeBlock);

  const session_id = req.query.sid || null;
  trackEvent({
    page_id: page.id,
    session_id,
    event_type: 'view',
    meta: { ua: req.headers['user-agent'] || '', ref: req.headers.referer || '' },
  });

  res.json({
    page: serializePage(page, theme),
    blocks,
  });
});

router.post('/public/:slug/event', (req, res) => {
  const page = db
    .prepare(`SELECT * FROM landing_pages WHERE slug = ? AND status = 'published'`)
    .get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Страница не найдена' });
  const event_type = (req.body?.event_type || 'custom').slice(0, 64);
  trackEvent({
    page_id: page.id,
    block_id: req.body?.block_id ? Number(req.body.block_id) : null,
    session_id: req.body?.session_id || null,
    event_type,
    meta: req.body?.meta || {},
    lead_id: req.body?.lead_id ? Number(req.body.lead_id) : null,
  });
  res.json({ ok: true });
});

router.post('/public/:slug/survey', (req, res) => {
  const page = db
    .prepare(`SELECT * FROM landing_pages WHERE slug = ? AND status = 'published'`)
    .get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Страница не найдена' });
  const block_id = req.body?.block_id ? Number(req.body.block_id) : null;
  const session_id = req.body?.session_id || `anon-${Date.now()}`;
  const answers = req.body?.answers || {};
  let score = req.body?.score != null ? Number(req.body.score) : null;

  // Auto-score simple quizzes if config has correct answers
  if (block_id && score == null) {
    const block = db.prepare('SELECT * FROM landing_blocks WHERE id = ?').get(block_id);
    const cfg = parseJson(block?.config_json, {});
    if (Array.isArray(cfg.questions)) {
      let ok = 0;
      let total = 0;
      for (const q of cfg.questions) {
        if (q.correct == null) continue;
        total += 1;
        if (String(answers[q.id]) === String(q.correct)) ok += 1;
      }
      if (total) score = Math.round((ok / total) * 100);
    }
  }

  const id = db
    .prepare(
      `INSERT INTO landing_survey_answers (page_id, block_id, session_id, lead_id, answers_json, score)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      page.id,
      block_id,
      session_id,
      req.body?.lead_id ? Number(req.body.lead_id) : null,
      JSON.stringify(answers),
      score
    ).lastInsertRowid;

  trackEvent({
    page_id: page.id,
    block_id,
    session_id,
    event_type: 'survey_submit',
    meta: { score },
  });

  // Gamification points
  const points = Number(req.body?.points) || (score != null ? Math.round(score / 2) : 10);
  upsertGame(page.id, session_id, points, { lastSurveyId: id });

  res.status(201).json({ ok: true, id, score, points });
});

router.post('/public/:slug/game', (req, res) => {
  const page = db
    .prepare(`SELECT * FROM landing_pages WHERE slug = ? AND status = 'published'`)
    .get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Страница не найдена' });
  const session_id = req.body?.session_id || `anon-${Date.now()}`;
  const delta = Number(req.body?.delta) || 0;
  const state = req.body?.state || {};
  const row = upsertGame(page.id, session_id, delta, state, req.body?.lead_id);
  trackEvent({
    page_id: page.id,
    session_id,
    event_type: 'game_update',
    meta: { score: row.score, delta },
  });
  res.json({ game: row });
});

router.get('/public/:slug/leaderboard', (req, res) => {
  const page = db
    .prepare(`SELECT * FROM landing_pages WHERE slug = ? AND status = 'published'`)
    .get(req.params.slug);
  if (!page) return res.status(404).json({ error: 'Страница не найдена' });
  const rows = db
    .prepare(
      `SELECT session_id, score, updated_at FROM landing_game_states
       WHERE page_id = ? ORDER BY score DESC, updated_at ASC LIMIT 20`
    )
    .all(page.id)
    .map((r, i) => ({
      rank: i + 1,
      label: `Игрок ${String(r.session_id).slice(-4)}`,
      score: r.score,
    }));
  res.json({ leaderboard: rows });
});

function upsertGame(pageId, sessionId, delta, statePatch = {}, leadId = null) {
  const existing = db
    .prepare(
      `SELECT * FROM landing_game_states WHERE page_id = ? AND session_id = ?`
    )
    .get(pageId, sessionId);
  if (existing) {
    const state = { ...parseJson(existing.state_json, {}), ...statePatch };
    const score = Math.max(0, existing.score + delta);
    db.prepare(
      `UPDATE landing_game_states
       SET score=?, state_json=?, lead_id=COALESCE(?, lead_id), updated_at=datetime('now')
       WHERE id=?`
    ).run(score, JSON.stringify(state), leadId ? Number(leadId) : null, existing.id);
    return db.prepare('SELECT * FROM landing_game_states WHERE id = ?').get(existing.id);
  }
  const id = db
    .prepare(
      `INSERT INTO landing_game_states (page_id, session_id, score, state_json, lead_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      pageId,
      sessionId,
      Math.max(0, delta),
      JSON.stringify(statePatch),
      leadId ? Number(leadId) : null
    ).lastInsertRowid;
  return db.prepare('SELECT * FROM landing_game_states WHERE id = ?').get(id);
}

module.exports = router;
