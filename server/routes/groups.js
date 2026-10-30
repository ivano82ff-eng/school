const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('office.groups')];

function enrichGroup(g) {
  const membersCount = db
    .prepare(
      `SELECT COUNT(*) as c FROM group_members WHERE group_id = ? AND status = 'active'`
    )
    .get(g.id).c;
  const course = g.course_id
    ? db.prepare('SELECT id, title FROM courses WHERE id = ?').get(g.course_id)
    : null;
  const teacher = g.teacher_id
    ? db.prepare('SELECT id, name FROM users WHERE id = ?').get(g.teacher_id)
    : null;
  return { ...g, membersCount, course, teacher };
}

router.get('/', ...staff, (req, res) => {
  const { status = 'active' } = req.query;
  let sql = 'SELECT * FROM groups WHERE 1=1';
  const params = [];
  if (status && status !== 'all') {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY name';
  res.json({ groups: db.prepare(sql).all(...params).map(enrichGroup) });
});

router.get('/:id', ...staff, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });
  const members = db
    .prepare(
      `SELECT gm.*, c.name, c.grade, c.phone, c.email
       FROM group_members gm
       JOIN contacts c ON c.id = gm.contact_id
       WHERE gm.group_id = ?
       ORDER BY c.name`
    )
    .all(group.id);
  const sessions = db
    .prepare(
      `SELECT * FROM schedule_sessions WHERE group_id = ? ORDER BY starts_at DESC LIMIT 10`
    )
    .all(group.id);
  res.json({ group: enrichGroup(group), members, sessions });
});

router.post('/', ...staff, (req, res) => {
  const {
    name,
    course_id = null,
    teacher_id = req.user.id,
    max_students = 12,
  } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Укажите название группы' });

  const info = db
    .prepare(
      `INSERT INTO groups (name, course_id, teacher_id, max_students)
       VALUES (?, ?, ?, ?)`
    )
    .run(name.trim(), course_id, teacher_id, max_students);

  res.status(201).json({
    group: enrichGroup(db.prepare('SELECT * FROM groups WHERE id = ?').get(info.lastInsertRowid)),
  });
});

router.put('/:id', ...staff, (req, res) => {
  const existing = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Группа не найдена' });

  const {
    name = existing.name,
    course_id = existing.course_id,
    teacher_id = existing.teacher_id,
    max_students = existing.max_students,
    status = existing.status,
  } = req.body || {};

  db.prepare(
    `UPDATE groups SET name=?, course_id=?, teacher_id=?, max_students=?, status=? WHERE id=?`
  ).run(name, course_id, teacher_id, max_students, status, existing.id);

  res.json({
    group: enrichGroup(db.prepare('SELECT * FROM groups WHERE id = ?').get(existing.id)),
  });
});

router.post('/:id/members', ...staff, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.body?.contact_id);
  if (!contact || contact.type !== 'student') {
    return res.status(400).json({ error: 'Можно добавить только ученика' });
  }

  const count = db
    .prepare(
      `SELECT COUNT(*) as c FROM group_members WHERE group_id = ? AND status = 'active'`
    )
    .get(group.id).c;
  if (count >= group.max_students) {
    return res.status(400).json({ error: 'Группа заполнена' });
  }

  db.prepare(
    `INSERT INTO group_members (group_id, contact_id, status)
     VALUES (?, ?, 'active')
     ON CONFLICT(group_id, contact_id) DO UPDATE SET status = 'active'`
  ).run(group.id, contact.id);

  // Also enroll login user into course if linked
  if (contact.user_id && group.course_id) {
    db.prepare(
      'INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)'
    ).run(contact.user_id, group.course_id);
  }

  res.json({ ok: true });
});

router.delete('/:id/members/:contactId', ...staff, (req, res) => {
  db.prepare(
    `UPDATE group_members SET status = 'left' WHERE group_id = ? AND contact_id = ?`
  ).run(req.params.id, req.params.contactId);
  res.json({ ok: true });
});

module.exports = router;
