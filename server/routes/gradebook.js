const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('office.gradebook')];

function studentRowsForGroup(groupId) {
  const members = db
    .prepare(
      `SELECT c.id as contact_id, c.name, c.grade, c.user_id, g.name as group_name, g.course_id
       FROM group_members gm
       JOIN contacts c ON c.id = gm.contact_id
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.group_id = ? AND gm.status = 'active' AND c.type = 'student'
       ORDER BY c.name`
    )
    .all(groupId);

  return members.map((m) => {
    const homework = db
      .prepare(
        `SELECT h.id, h.title, h.due_date, hs.status, hs.grade, hs.teacher_note, hs.submitted_at
         FROM homework h
         LEFT JOIN homework_submissions hs
           ON hs.homework_id = h.id AND hs.contact_id = ?
         WHERE h.group_id = ?
         ORDER BY h.due_date, h.id`
      )
      .all(m.contact_id, groupId);

    let quizzes = [];
    if (m.user_id && m.course_id) {
      quizzes = db
        .prepare(
          `SELECT q.id, q.title, l.title as lesson_title,
                  qa.score, qa.total, qa.created_at,
                  ROUND(100.0 * qa.score / NULLIF(qa.total, 0), 1) as percent
           FROM quizzes q
           JOIN lessons l ON l.id = q.lesson_id
           LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.user_id = ?
           WHERE l.course_id = ?
           ORDER BY l.sort_order, q.id`
        )
        .all(m.user_id, m.course_id);
    }

    const gradedHw = homework.filter((h) => h.grade != null && h.grade !== '');
    const quizDone = quizzes.filter((q) => q.score != null);
    const quizAvg =
      quizDone.length > 0
        ? Math.round(
            (quizDone.reduce((s, q) => s + Number(q.percent || 0), 0) / quizDone.length) * 10
          ) / 10
        : null;

    return {
      ...m,
      homework,
      quizzes,
      stats: {
        homeworkTotal: homework.length,
        homeworkDone: homework.filter((h) =>
          ['submitted', 'reviewed', 'done'].includes(h.status)
        ).length,
        homeworkGraded: gradedHw.length,
        quizAvg,
        quizAttempts: quizDone.length,
      },
    };
  });
}

router.get('/', ...staff, (req, res) => {
  const groupId = req.query.group_id ? Number(req.query.group_id) : null;
  const groups = db
    .prepare(
      `SELECT g.id, g.name, c.title as course_title
       FROM groups g
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE g.status = 'active'
       ORDER BY g.name`
    )
    .all();

  if (!groupId) {
    return res.json({ groups, students: [] });
  }

  const group = groups.find((g) => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });

  res.json({
    groups,
    group,
    students: studentRowsForGroup(groupId),
  });
});

/** Student own grades */
router.get('/me', authRequired, requirePermission('student.learn', 'office.gradebook'), (req, res) => {
  const contact = db
    .prepare(`SELECT * FROM contacts WHERE user_id = ? AND type = 'student'`)
    .get(req.user.id);
  if (!contact) return res.json({ groups: [] });

  const memberships = db
    .prepare(
      `SELECT g.id FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.contact_id = ? AND gm.status = 'active'`
    )
    .all(contact.id);

  const groups = memberships.map((m) => {
    const rows = studentRowsForGroup(m.id);
    const me = rows.find((r) => r.contact_id === contact.id);
    const group = db
      .prepare(
        `SELECT g.id, g.name, c.title as course_title
         FROM groups g LEFT JOIN courses c ON c.id = g.course_id WHERE g.id = ?`
      )
      .get(m.id);
    return { group, student: me };
  });

  res.json({ groups });
});

module.exports = router;
