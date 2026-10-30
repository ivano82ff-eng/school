const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('office.attendance')];

router.get('/sessions', ...staff, (_req, res) => {
  const sessions = db
    .prepare(
      `SELECT s.id, s.title, s.starts_at, s.ends_at, s.status, s.group_id, g.name as group_name
       FROM schedule_sessions s
       JOIN groups g ON g.id = s.group_id
       ORDER BY s.starts_at DESC`
    )
    .all()
    .map((s) => ({
      id: s.id,
      title: s.title,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      status: s.status,
      group: { id: s.group_id, name: s.group_name },
    }));
  res.json({ sessions });
});

router.get('/session/:sessionId', ...staff, (req, res) => {
  const session = db
    .prepare('SELECT * FROM schedule_sessions WHERE id = ?')
    .get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Занятие не найдено' });

  const members = db
    .prepare(
      `SELECT c.id as contact_id, c.name, c.grade,
              a.status as attendance_status, a.note, a.id as attendance_id
       FROM group_members gm
       JOIN contacts c ON c.id = gm.contact_id
       LEFT JOIN attendance a ON a.contact_id = c.id AND a.session_id = ?
       WHERE gm.group_id = ? AND gm.status = 'active'
       ORDER BY c.name`
    )
    .all(session.id, session.group_id);

  res.json({ session, roster: members });
});

router.post('/session/:sessionId', ...staff, (req, res) => {
  const session = db
    .prepare('SELECT * FROM schedule_sessions WHERE id = ?')
    .get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Занятие не найдено' });

  const marks = Array.isArray(req.body?.marks) ? req.body.marks : [];
  const upsert = db.prepare(
    `INSERT INTO attendance (session_id, contact_id, status, note, marked_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(session_id, contact_id) DO UPDATE SET
       status = excluded.status,
       note = excluded.note,
       marked_at = datetime('now')`
  );

  db.exec('BEGIN');
  try {
    for (const m of marks) {
      if (!m.contact_id || !m.status) continue;
      upsert.run(session.id, m.contact_id, m.status, m.note || null);
    }
    db.prepare(
      `UPDATE schedule_sessions SET status = 'done' WHERE id = ? AND status = 'planned'`
    ).run(session.id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  res.json({ ok: true });
});

router.get('/student/:contactId', ...staff, (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, s.title, s.starts_at, g.name as group_name
       FROM attendance a
       JOIN schedule_sessions s ON s.id = a.session_id
       JOIN groups g ON g.id = s.group_id
       WHERE a.contact_id = ?
       ORDER BY s.starts_at DESC
       LIMIT 50`
    )
    .all(req.params.contactId);
  res.json({ attendance: rows });
});

module.exports = router;
