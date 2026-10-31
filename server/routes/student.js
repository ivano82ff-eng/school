const express = require('express');
const db = require('../db');
const { authRequired, requirePermission, userCan } = require('../middleware/auth');
const { maybeIssueCertificate } = require('../services/certificates');

const router = express.Router();

function studentContact(userId) {
  return db
    .prepare(`SELECT * FROM contacts WHERE user_id = ? AND type = 'student'`)
    .get(userId);
}

router.get('/dashboard', authRequired, requirePermission('student.learn'), (req, res) => {
  const contact = studentContact(req.user.id);

  const courses = db
    .prepare(
      `SELECT c.* FROM courses c
       JOIN enrollments e ON e.course_id = c.id
       WHERE e.user_id = ?
       ORDER BY e.enrolled_at DESC`
    )
    .all(req.user.id)
    .map((c) => {
      const lessonsCount = db
        .prepare('SELECT COUNT(*) as c FROM lessons WHERE course_id = ?')
        .get(c.id).c;
      const completedLessons = db
        .prepare(
          `SELECT COUNT(*) as c FROM lesson_progress lp
           JOIN lessons l ON l.id = lp.lesson_id
           WHERE lp.user_id = ? AND l.course_id = ? AND lp.completed = 1`
        )
        .get(req.user.id, c.id).c;
      return { ...c, lessonsCount, completedLessons };
    });

  let homework = [];
  let upcoming = [];
  let attendance = [];

  if (contact) {
    homework = db
      .prepare(
        `SELECT hs.id as submission_id, hs.status, hs.answer, hs.grade, hs.teacher_note,
                h.id as homework_id, h.title, h.description, h.due_date, g.name as group_name
         FROM homework_submissions hs
         JOIN homework h ON h.id = hs.homework_id
         JOIN groups g ON g.id = h.group_id
         WHERE hs.contact_id = ?
         ORDER BY h.due_date ASC, h.created_at DESC
         LIMIT 20`
      )
      .all(contact.id);

    upcoming = db
      .prepare(
        `SELECT s.id, s.title, s.starts_at, s.ends_at, s.location, g.name as group_name
         FROM schedule_sessions s
         JOIN groups g ON g.id = s.group_id
         JOIN group_members gm ON gm.group_id = g.id AND gm.contact_id = ? AND gm.status = 'active'
         WHERE s.starts_at >= datetime('now') AND s.status = 'planned'
         ORDER BY s.starts_at ASC
         LIMIT 8`
      )
      .all(contact.id);

    attendance = db
      .prepare(
        `SELECT a.status, COUNT(*) as c FROM attendance a
         WHERE a.contact_id = ? GROUP BY a.status`
      )
      .all(contact.id);
  }

  const announcements = db
    .prepare(
      `SELECT id, title, body, created_at FROM announcements
       WHERE published = 1 AND audience IN ('all', 'students')
       ORDER BY created_at DESC LIMIT 5`
    )
    .all();

  const materials = db
    .prepare(
      `SELECT m.id, m.course_id, m.title, m.url, m.description, m.file_id, f.original_name,
              c.title AS course_title, c.icon
       FROM course_materials m
       JOIN courses c ON c.id = m.course_id
       JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
       LEFT JOIN files f ON f.id = m.file_id
       ORDER BY c.title, m.sort_order, m.id`
    )
    .all(req.user.id);

  const certificates = db
    .prepare(
      `SELECT cert.*, c.title as course_title, c.icon
       FROM certificates cert
       JOIN courses c ON c.id = cert.course_id
       WHERE cert.user_id = ?
       ORDER BY cert.issued_at DESC`
    )
    .all(req.user.id);

  res.json({
    contact,
    courses,
    homework,
    upcoming,
    attendance,
    announcements,
    certificates,
    materials,
  });
});

router.post('/homework/:submissionId/submit', authRequired, requirePermission('student.learn'), (req, res) => {
  const contact = studentContact(req.user.id);
  if (!contact) return res.status(400).json({ error: 'Контакт ученика не найден' });

  const sub = db
    .prepare('SELECT * FROM homework_submissions WHERE id = ?')
    .get(req.params.submissionId);
  if (!sub || sub.contact_id !== contact.id) {
    return res.status(404).json({ error: 'Задание не найдено' });
  }

  const answer = (req.body?.answer || '').trim();
  if (!answer) return res.status(400).json({ error: 'Напиши ответ' });

  db.prepare(
    `UPDATE homework_submissions
     SET answer = ?, status = 'submitted', submitted_at = datetime('now')
     WHERE id = ?`
  ).run(answer, sub.id);

  const hw = db.prepare('SELECT title, created_by FROM homework WHERE id = ?').get(sub.homework_id);
  if (hw?.created_by) {
    const { notifyUser } = require('../services/notify');
    notifyUser(hw.created_by, {
      title: 'Сдано ДЗ',
      body: `${contact.name}: ${hw.title}`,
      link: '/office/homework',
      type: 'homework',
    });
  }

  res.json({
    submission: db.prepare('SELECT * FROM homework_submissions WHERE id = ?').get(sub.id),
  });
});

router.post('/courses/:courseId/check-certificate', authRequired, requirePermission('student.learn'), (req, res) => {
  const cert = maybeIssueCertificate(req.user.id, Number(req.params.courseId));
  res.json({ certificate: cert });
});

router.get('/certificates/:id', authRequired, (req, res) => {
  const cert = db
    .prepare(
      `SELECT cert.*, c.title as course_title, c.icon, c.category, u.name as student_name
       FROM certificates cert
       JOIN courses c ON c.id = cert.course_id
       JOIN users u ON u.id = cert.user_id
       WHERE cert.id = ?`
    )
    .get(req.params.id);
  if (!cert) return res.status(404).json({ error: 'Сертификат не найден' });
  if (cert.user_id !== req.user.id && !userCan(req.user, 'content.teach')) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json({ certificate: cert });
});

module.exports = router;
