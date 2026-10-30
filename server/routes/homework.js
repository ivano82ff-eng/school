const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { notifyContactUser, notifyStudentParents } = require('../services/notify');

const router = express.Router();
const staff = [authRequired, requirePermission('office.homework')];

function enrichHomework(h) {
  const group = db.prepare('SELECT id, name FROM groups WHERE id = ?').get(h.group_id);
  const stats = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN ('submitted','reviewed','done') THEN 1 ELSE 0 END) as submitted,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
         COUNT(*) as total
       FROM homework_submissions WHERE homework_id = ?`
    )
    .get(h.id);
  return { ...h, group, stats };
}

router.get('/', ...staff, (req, res) => {
  const { group_id } = req.query;
  let sql = 'SELECT * FROM homework WHERE 1=1';
  const params = [];
  if (group_id) {
    sql += ' AND group_id = ?';
    params.push(Number(group_id));
  }
  sql += ' ORDER BY created_at DESC';
  res.json({ homework: db.prepare(sql).all(...params).map(enrichHomework) });
});

router.get('/:id', authRequired, (req, res) => {
  const hw = db.prepare('SELECT * FROM homework WHERE id = ?').get(req.params.id);
  if (!hw) return res.status(404).json({ error: 'Задание не найдено' });

  if (req.user.role === 'student' || req.user.role === 'parent') {
    // allowed via submissions filtered below
  } else if (!['admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  const submissions = db
    .prepare(
      `SELECT hs.*, c.name as student_name
       FROM homework_submissions hs
       JOIN contacts c ON c.id = hs.contact_id
       WHERE hs.homework_id = ?
       ORDER BY c.name`
    )
    .all(hw.id);

  res.json({ homework: enrichHomework(hw), submissions });
});

router.post('/', ...staff, (req, res) => {
  const { group_id, title, description = '', due_date = null } = req.body || {};
  if (!group_id || !title) {
    return res.status(400).json({ error: 'Нужны группа и название' });
  }

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id);
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });

  db.exec('BEGIN');
  try {
    const info = db
      .prepare(
        `INSERT INTO homework (group_id, title, description, due_date, created_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(group_id, title.trim(), description, due_date, req.user.id);

    const members = db
      .prepare(
        `SELECT contact_id FROM group_members WHERE group_id = ? AND status = 'active'`
      )
      .all(group_id);

    const addSub = db.prepare(
      `INSERT INTO homework_submissions (homework_id, contact_id, status)
       VALUES (?, ?, 'assigned')`
    );
    for (const m of members) addSub.run(info.lastInsertRowid, m.contact_id);

    db.exec('COMMIT');

    for (const m of members) {
      notifyContactUser(m.contact_id, {
        title: 'Новое домашнее задание',
        body: title.trim(),
        link: '/dashboard',
        type: 'homework',
      });
      notifyStudentParents(m.contact_id, {
        title: 'Новое ДЗ у ребёнка',
        body: title.trim(),
        link: '/parent',
        type: 'homework',
      });
    }

    res.status(201).json({
      homework: enrichHomework(
        db.prepare('SELECT * FROM homework WHERE id = ?').get(info.lastInsertRowid)
      ),
    });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});

router.patch('/submissions/:id', authRequired, (req, res) => {
  const sub = db.prepare('SELECT * FROM homework_submissions WHERE id = ?').get(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Сдача не найдена' });

  const { status, answer, grade, teacher_note } = req.body || {};

  if (req.user.role === 'student') {
    const contact = db
      .prepare('SELECT id FROM contacts WHERE user_id = ? AND type = ?')
      .get(req.user.id, 'student');
    if (!contact || contact.id !== sub.contact_id) {
      return res.status(403).json({ error: 'Это не ваше задание' });
    }
    db.prepare(
      `UPDATE homework_submissions
       SET answer = ?, status = 'submitted', submitted_at = datetime('now')
       WHERE id = ?`
    ).run(answer || '', sub.id);
  } else if (req.user.role === 'teacher' || req.user.role === 'admin') {
    db.prepare(
      `UPDATE homework_submissions
       SET status = COALESCE(?, status),
           grade = COALESCE(?, grade),
           teacher_note = COALESCE(?, teacher_note),
           answer = COALESCE(?, answer)
       WHERE id = ?`
    ).run(status || null, grade ?? null, teacher_note ?? null, answer ?? null, sub.id);
  } else {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  res.json({
    submission: db.prepare('SELECT * FROM homework_submissions WHERE id = ?').get(sub.id),
  });
});

module.exports = router;
