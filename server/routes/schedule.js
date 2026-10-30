const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('office.schedule')];

function enrich(s) {
  const group = db.prepare('SELECT id, name FROM groups WHERE id = ?').get(s.group_id);
  const teacher = s.teacher_id
    ? db.prepare('SELECT id, name FROM users WHERE id = ?').get(s.teacher_id)
    : null;
  const membersCount = db
    .prepare(
      `SELECT COUNT(*) as c FROM group_members WHERE group_id = ? AND status = 'active'`
    )
    .get(s.group_id).c;
  return { ...s, group, teacher, membersCount };
}

router.get('/', ...staff, (req, res) => {
  const { from, to, group_id } = req.query;
  let sql = 'SELECT * FROM schedule_sessions WHERE 1=1';
  const params = [];
  if (from) {
    sql += ' AND starts_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND starts_at <= ?';
    params.push(to);
  }
  if (group_id) {
    sql += ' AND group_id = ?';
    params.push(Number(group_id));
  }
  sql += ' ORDER BY starts_at ASC';
  res.json({ sessions: db.prepare(sql).all(...params).map(enrich) });
});

router.post('/', ...staff, (req, res) => {
  const {
    group_id,
    teacher_id = req.user.id,
    title = '',
    starts_at,
    ends_at,
    location = '',
  } = req.body || {};

  if (!group_id || !starts_at || !ends_at) {
    return res.status(400).json({ error: 'Нужны группа, начало и конец занятия' });
  }

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id);
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });

  const info = db
    .prepare(
      `INSERT INTO schedule_sessions (group_id, teacher_id, title, starts_at, ends_at, location)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(group_id, teacher_id || group.teacher_id, title, starts_at, ends_at, location);

  res.status(201).json({
    session: enrich(
      db.prepare('SELECT * FROM schedule_sessions WHERE id = ?').get(info.lastInsertRowid)
    ),
  });
});

router.patch('/:id', ...staff, (req, res) => {
  const existing = db.prepare('SELECT * FROM schedule_sessions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Занятие не найдено' });

  const {
    title = existing.title,
    starts_at = existing.starts_at,
    ends_at = existing.ends_at,
    location = existing.location,
    status = existing.status,
    teacher_id = existing.teacher_id,
  } = req.body || {};

  db.prepare(
    `UPDATE schedule_sessions
     SET title=?, starts_at=?, ends_at=?, location=?, status=?, teacher_id=?
     WHERE id=?`
  ).run(title, starts_at, ends_at, location, status, teacher_id, existing.id);

  res.json({
    session: enrich(db.prepare('SELECT * FROM schedule_sessions WHERE id = ?').get(existing.id)),
  });
});

router.delete('/:id', ...staff, (req, res) => {
  db.prepare('DELETE FROM schedule_sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
