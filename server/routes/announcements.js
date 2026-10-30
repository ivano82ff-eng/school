const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { notifyRole, notifyUsers } = require('../services/notify');

const router = express.Router();
const staff = [authRequired, requirePermission('office.announcements')];

function visibleFor(user) {
  if (!user) return `audience = 'all'`;
  if (user.role === 'admin' || user.role === 'teacher') {
    return `published = 1`;
  }
  if (user.role === 'parent') {
    return `published = 1 AND audience IN ('all', 'parents')`;
  }
  return `published = 1 AND audience IN ('all', 'students')`;
}

router.get('/', authRequired, (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, u.name as author_name, g.name as group_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       LEFT JOIN groups g ON g.id = a.group_id
       WHERE ${visibleFor(req.user)}
       ORDER BY a.created_at DESC
       LIMIT 50`
    )
    .all();
  res.json({ announcements: rows });
});

router.post('/', ...staff, (req, res) => {
  const {
    title,
    body,
    audience = 'all',
    group_id = null,
  } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: 'Нужны заголовок и текст' });
  }

  const info = db
    .prepare(
      `INSERT INTO announcements (title, body, audience, group_id, author_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(title.trim(), body.trim(), audience, group_id, req.user.id);

  const payload = {
    title: `Объявление: ${title.trim()}`,
    body: body.trim().slice(0, 160),
    link: '/dashboard',
    type: 'announcement',
  };

  if (audience === 'students' || audience === 'all') notifyRole('student', payload);
  if (audience === 'parents' || audience === 'all') notifyRole('parent', payload);
  if (audience === 'staff') {
    notifyRole('teacher', payload);
    notifyRole('admin', payload);
  }
  if (audience === 'group' && group_id) {
    const members = db
      .prepare(
        `SELECT c.user_id FROM group_members gm
         JOIN contacts c ON c.id = gm.contact_id
         WHERE gm.group_id = ? AND gm.status = 'active' AND c.user_id IS NOT NULL`
      )
      .all(group_id);
    notifyUsers(
      members.map((m) => m.user_id),
      payload
    );
  }

  res.status(201).json({
    announcement: db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid),
  });
});

router.delete('/:id', ...staff, (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
