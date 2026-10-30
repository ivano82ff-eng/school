const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const unreadOnly = req.query.unread === '1';
  let sql = 'SELECT * FROM notifications WHERE user_id = ?';
  if (unreadOnly) sql += ' AND read_at IS NULL';
  sql += ' ORDER BY created_at DESC LIMIT 40';
  const items = db.prepare(sql).all(req.user.id);
  const unread = db
    .prepare(
      `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_at IS NULL`
    )
    .get(req.user.id).c;
  res.json({ notifications: items, unread });
});

router.post('/read-all', authRequired, (req, res) => {
  db.prepare(
    `UPDATE notifications SET read_at = datetime('now')
     WHERE user_id = ? AND read_at IS NULL`
  ).run(req.user.id);
  res.json({ ok: true });
});

router.post('/:id/read', authRequired, (req, res) => {
  db.prepare(
    `UPDATE notifications SET read_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
