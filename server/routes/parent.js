const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { refreshOverduePayments } = require('../services/helpers');

const router = express.Router();

router.use(authRequired, requirePermission('parent.portal'));

function parentContact(userId) {
  return db
    .prepare(`SELECT * FROM contacts WHERE user_id = ? AND type = 'parent'`)
    .get(userId);
}

function childrenOf(parentContactId) {
  return db
    .prepare(
      `SELECT c.* FROM contacts c
       JOIN contact_links l ON l.student_id = c.id
       WHERE l.parent_id = ?`
    )
    .all(parentContactId);
}

router.get('/dashboard', (req, res) => {
  refreshOverduePayments();
  const parent = parentContact(req.user.id);
  if (!parent && req.user.role === 'parent') {
    return res.status(404).json({ error: 'Контакт родителя не привязан к аккаунту' });
  }

  // admin preview: show all demo parent links if no contact
  const kids = parent
    ? childrenOf(parent.id)
    : db.prepare(`SELECT * FROM contacts WHERE type = 'student' LIMIT 5`).all();

  const children = kids.map((child) => {
    const groups = db
      .prepare(
        `SELECT g.id, g.name, g.course_id, c.title as course_title
         FROM group_members gm
         JOIN groups g ON g.id = gm.group_id
         LEFT JOIN courses c ON c.id = g.course_id
         WHERE gm.contact_id = ? AND gm.status = 'active'`
      )
      .all(child.id);

    const payments = db
      .prepare(
        `SELECT * FROM payments WHERE contact_id = ? ORDER BY due_date DESC LIMIT 10`
      )
      .all(child.id);

    const attendance = db
      .prepare(
        `SELECT a.status, COUNT(*) as c FROM attendance a
         WHERE a.contact_id = ? GROUP BY a.status`
      )
      .all(child.id);

    const homework = db
      .prepare(
        `SELECT hs.status, h.title, h.due_date, hs.grade
         FROM homework_submissions hs
         JOIN homework h ON h.id = hs.homework_id
         WHERE hs.contact_id = ?
         ORDER BY h.due_date DESC
         LIMIT 10`
      )
      .all(child.id);

    const upcoming = db
      .prepare(
        `SELECT s.title, s.starts_at, s.location, g.name as group_name
         FROM schedule_sessions s
         JOIN groups g ON g.id = s.group_id
         JOIN group_members gm ON gm.group_id = g.id AND gm.contact_id = ? AND gm.status = 'active'
         WHERE s.starts_at >= datetime('now') AND s.status = 'planned'
         ORDER BY s.starts_at ASC
         LIMIT 5`
      )
      .all(child.id);

    const grades = groups.map((g) => {
      const gradedHw = db
        .prepare(
          `SELECT h.title, hs.grade, hs.status
           FROM homework h
           LEFT JOIN homework_submissions hs ON hs.homework_id = h.id AND hs.contact_id = ?
           WHERE h.group_id = ? AND hs.grade IS NOT NULL AND hs.grade != ''
           ORDER BY h.due_date DESC LIMIT 5`
        )
        .all(child.id, g.id);
      let quizAvg = null;
      if (child.user_id && g.course_id) {
        const row = db
          .prepare(
            `SELECT AVG(100.0 * qa.score / NULLIF(qa.total, 0)) as avg
             FROM quiz_attempts qa
             JOIN quizzes q ON q.id = qa.quiz_id
             JOIN lessons l ON l.id = q.lesson_id
             WHERE qa.user_id = ? AND l.course_id = ?`
          )
          .get(child.user_id, g.course_id);
        quizAvg = row?.avg != null ? Math.round(row.avg * 10) / 10 : null;
      }
      return { group_id: g.id, group_name: g.name, homework: gradedHw, quizAvg };
    });

    return { child, groups, payments, attendance, homework, upcoming, grades };
  });

  res.json({ parent, children });
});

module.exports = router;
