const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { notifyRole, notifyUsers } = require('../services/notify');

const router = express.Router();
const staff = [authRequired, requirePermission('office.announcements')];

function announcementScope(user) {
  if (!user) return { sql: `published = 1 AND audience = 'all'`, params: [] };
  if (user.role === 'student') {
    return {
      sql: `published = 1 AND (
        audience IN ('all', 'students')
        OR (
          audience = 'group' AND group_id IN (
            SELECT gm.group_id FROM group_members gm
            JOIN contacts c ON c.id = gm.contact_id
            WHERE c.user_id = ? AND c.type = 'student' AND gm.status = 'active'
          )
        )
      )`,
      params: [user.id],
    };
  }
  if (user.role === 'parent') {
    return {
      sql: `published = 1 AND (
        audience IN ('all', 'parents')
        OR (
          audience = 'group' AND group_id IN (
            SELECT gm.group_id FROM group_members gm
            JOIN contact_links l ON l.student_id = gm.contact_id
            JOIN contacts p ON p.id = l.parent_id
            WHERE p.user_id = ? AND gm.status = 'active'
          )
        )
      )`,
      params: [user.id],
    };
  }
  // Office staff see the same published feed, including parent, staff, and group notes.
  return { sql: `published = 1`, params: [] };
}

router.get('/', authRequired, (req, res) => {
  const scope = announcementScope(req.user);
  const rows = db
    .prepare(
      `SELECT a.*, u.name as author_name, g.name as group_name
       FROM announcements a
       LEFT JOIN users u ON u.id = a.author_id
       LEFT JOIN groups g ON g.id = a.group_id
       WHERE ${scope.sql}
       ORDER BY a.created_at DESC
       LIMIT 50`
    )
    .all(...scope.params);
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
    const staffUsers = db
      .prepare(`SELECT id FROM users WHERE active = 1 AND role NOT IN ('student', 'parent')`)
      .all();
    notifyUsers(
      staffUsers.map((u) => u.id),
      payload
    );
  }
  if (audience === 'group' && group_id) {
    const members = db
      .prepare(
        `SELECT c.user_id FROM group_members gm
         JOIN contacts c ON c.id = gm.contact_id
         WHERE gm.group_id = ? AND gm.status = 'active' AND c.user_id IS NOT NULL
         UNION
         SELECT p.user_id FROM group_members gm
         JOIN contact_links l ON l.student_id = gm.contact_id
         JOIN contacts p ON p.id = l.parent_id
         WHERE gm.group_id = ? AND gm.status = 'active' AND p.user_id IS NOT NULL`
      )
      .all(group_id, group_id);
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
