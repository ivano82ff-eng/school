const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { notifyRole } = require('../services/notify');

const router = express.Router();
const staff = [authRequired, requirePermission('office.trials')];

const STATUSES = ['scheduled', 'done', 'no_show', 'converted', 'cancelled'];

function enrich(row) {
  if (!row) return row;
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(row.lead_id);
  const teacher = row.teacher_id
    ? db.prepare('SELECT id, name FROM users WHERE id = ?').get(row.teacher_id)
    : null;
  const course = row.course_id
    ? db.prepare('SELECT id, title FROM courses WHERE id = ?').get(row.course_id)
    : null;
  return { ...row, lead, teacher, course };
}

router.get('/', ...staff, (req, res) => {
  const { status, from } = req.query;
  let sql = `SELECT * FROM trial_lessons WHERE 1=1`;
  const params = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (from) {
    sql += ' AND starts_at >= ?';
    params.push(from);
  }
  sql += ' ORDER BY starts_at ASC';
  res.json({ trials: db.prepare(sql).all(...params).map(enrich), statuses: STATUSES });
});

router.get('/upcoming', ...staff, (_req, res) => {
  const trials = db
    .prepare(
      `SELECT * FROM trial_lessons
       WHERE status = 'scheduled' AND starts_at >= datetime('now')
       ORDER BY starts_at ASC LIMIT 20`
    )
    .all()
    .map(enrich);
  res.json({ trials });
});

router.post('/', ...staff, (req, res) => {
  const lead_id = Number(req.body?.lead_id);
  const starts_at = (req.body?.starts_at || '').trim();
  const ends_at = (req.body?.ends_at || '').trim();
  const title = (req.body?.title || 'Пробное занятие').trim();
  const location = (req.body?.location || '').trim() || null;
  const course_id = req.body?.course_id ? Number(req.body.course_id) : null;
  const teacher_id = req.body?.teacher_id ? Number(req.body.teacher_id) : req.user.id;

  if (!lead_id || !starts_at || !ends_at) {
    return res.status(400).json({ error: 'Нужны lead_id, starts_at, ends_at' });
  }
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(lead_id);
  if (!lead) return res.status(404).json({ error: 'Заявка не найдена' });

  const id = db
    .prepare(
      `INSERT INTO trial_lessons
       (lead_id, teacher_id, course_id, title, starts_at, ends_at, location, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(lead_id, teacher_id, course_id, title, starts_at, ends_at, location, req.user.id)
    .lastInsertRowid;

  db.prepare(
    `UPDATE leads SET status = 'trial', updated_at = datetime('now') WHERE id = ? AND status IN ('new','contacted','trial')`
  ).run(lead_id);

  notifyRole('admin', {
    title: 'Назначен пробный урок',
    body: `${lead.child_name || lead.name}: ${starts_at}`,
    link: '/office/trials',
    type: 'trial',
  });

  res.status(201).json({ trial: enrich(db.prepare('SELECT * FROM trial_lessons WHERE id = ?').get(id)) });
});

router.patch('/:id', ...staff, (req, res) => {
  const trial = db.prepare('SELECT * FROM trial_lessons WHERE id = ?').get(req.params.id);
  if (!trial) return res.status(404).json({ error: 'Пробный урок не найден' });

  const status = req.body?.status || trial.status;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Неизвестный статус' });
  }

  const outcome_notes =
    req.body?.outcome_notes != null ? String(req.body.outcome_notes) : trial.outcome_notes;
  const title = req.body?.title != null ? String(req.body.title).trim() : trial.title;
  const location = req.body?.location !== undefined ? req.body.location : trial.location;
  const starts_at = req.body?.starts_at || trial.starts_at;
  const ends_at = req.body?.ends_at || trial.ends_at;

  db.prepare(
    `UPDATE trial_lessons
     SET status=?, outcome_notes=?, title=?, location=?, starts_at=?, ends_at=?
     WHERE id=?`
  ).run(status, outcome_notes, title, location, starts_at, ends_at, trial.id);

  if (status === 'converted') {
    db.prepare(
      `UPDATE leads SET status='won', updated_at=datetime('now') WHERE id=?`
    ).run(trial.lead_id);
  }
  if (status === 'no_show' || status === 'cancelled') {
    // keep lead in trial unless explicitly lost via body
    if (req.body?.mark_lead_lost) {
      db.prepare(
        `UPDATE leads SET status='lost', updated_at=datetime('now'), notes=COALESCE(notes,'') || ?
         WHERE id=?`
      ).run(`\n[пробный #${trial.id}] ${outcome_notes}`, trial.lead_id);
    }
  }

  res.json({ trial: enrich(db.prepare('SELECT * FROM trial_lessons WHERE id = ?').get(trial.id)) });
});

router.delete('/:id', ...staff, (req, res) => {
  const info = db.prepare('DELETE FROM trial_lessons WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

module.exports = router;
