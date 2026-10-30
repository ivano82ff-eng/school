const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const {
  runDataset,
  serializeBoard,
  canRunDataset,
  datasetsFor,
  presetsFor,
} = require('../services/analyticsDatasets');

const router = express.Router();
const staff = [
  authRequired,
  requirePermission('office.reports', 'marketing.analytics', 'marketing.landings'),
];

router.get('/meta', ...staff, (req, res) => {
  const presets = presetsFor(req.user.role);
  res.json({
    datasets: datasetsFor(req.user.role),
    presets: presets.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      widgetCount: p.layout.widgets.length,
    })),
    chartTypes: ['bar', 'line', 'pie', 'funnel', 'kpi', 'table'],
    exportFormats: ['html', 'pdf', 'pptx', 'csv', 'json'],
  });
});

router.get('/presets/:code', ...staff, (req, res) => {
  const preset = presetsFor(req.user.role).find((p) => p.code === req.params.code);
  if (!preset) return res.status(404).json({ error: 'Шаблон не найден' });
  res.json({ preset });
});

router.get('/dataset/:code', ...staff, (req, res) => {
  const code = req.params.code;
  if (!canRunDataset(req.user.role, code)) {
    return res.status(403).json({ error: 'Недостаточно прав для этого отчёта' });
  }
  const data = runDataset(code, {
    landingId: req.query.landing_id || null,
    days: req.query.days || 30,
  });
  if (data.error) return res.status(400).json(data);
  res.json({ code, ...data });
});

router.post('/datasets/batch', ...staff, (req, res) => {
  const codes = Array.isArray(req.body?.codes) ? req.body.codes : [];
  const opts = {
    landingId: req.body?.landing_id || null,
    days: req.body?.days || 30,
  };
  const result = {};
  for (const code of codes) {
    if (canRunDataset(req.user.role, code)) {
      result[code] = runDataset(code, opts);
    }
  }
  res.json({ datasets: result });
});

router.get('/boards', ...staff, (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.*, u.name as author_name
       FROM report_boards b
       LEFT JOIN users u ON u.id = b.created_by
       WHERE b.shared = 1 OR b.created_by = ?
       ORDER BY b.updated_at DESC`
    )
    .all(req.user.id)
    .map(serializeBoard);
  res.json({ boards: rows });
});

router.post('/boards', ...staff, (req, res) => {
  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Укажите название отчёта' });
  const preset_code = req.body?.preset_code || null;
  let layout = req.body?.layout;
  if (!layout && preset_code) {
    const preset = presetsFor(req.user.role).find((p) => p.code === preset_code);
    layout = preset?.layout || { widgets: [] };
  }
  layout = layout || { widgets: [] };
  const id = db
    .prepare(
      `INSERT INTO report_boards (title, description, preset_code, layout_json, created_by, shared)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      req.body?.description || '',
      preset_code,
      JSON.stringify(layout),
      req.user.id,
      req.body?.shared === false ? 0 : 1
    ).lastInsertRowid;
  res.status(201).json({
    board: serializeBoard(db.prepare('SELECT * FROM report_boards WHERE id = ?').get(id)),
  });
});

router.get('/boards/:id', ...staff, (req, res) => {
  const row = db.prepare('SELECT * FROM report_boards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Отчёт не найден' });
  res.json({ board: serializeBoard(row) });
});

router.patch('/boards/:id', ...staff, (req, res) => {
  const row = db.prepare('SELECT * FROM report_boards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Отчёт не найден' });
  const title = req.body.title != null ? String(req.body.title).trim() : row.title;
  const description =
    req.body.description != null ? String(req.body.description) : row.description;
  const layout_json =
    req.body.layout != null ? JSON.stringify(req.body.layout) : row.layout_json;
  const shared =
    req.body.shared !== undefined ? (req.body.shared ? 1 : 0) : row.shared;
  db.prepare(
    `UPDATE report_boards
     SET title=?, description=?, layout_json=?, shared=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(title, description, layout_json, shared, row.id);
  res.json({
    board: serializeBoard(db.prepare('SELECT * FROM report_boards WHERE id = ?').get(row.id)),
  });
});

router.delete('/boards/:id', ...staff, (req, res) => {
  const info = db.prepare('DELETE FROM report_boards WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Отчёт не найден' });
  res.json({ ok: true });
});

/** Snapshot for client-side export (html/pdf/pptx/csv) */
router.post('/export-payload', ...staff, (req, res) => {
  const layout = req.body?.layout || { widgets: [] };
  const opts = {
    landingId: req.body?.landing_id || null,
    days: req.body?.days || 30,
  };
  const widgets = (layout.widgets || []).map((w) => {
    if (w.dataset && !canRunDataset(req.user.role, w.dataset)) {
      return { ...w, data: { series: [], error: 'forbidden' } };
    }
    const data = w.dataset ? runDataset(w.dataset, opts) : { series: [] };
    return { ...w, data };
  });
  res.json({
    title: req.body?.title || 'Отчёт IT-Scool',
    generatedAt: new Date().toISOString(),
    widgets,
  });
});

module.exports = router;
