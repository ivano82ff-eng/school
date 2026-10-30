const db = require('../db');

function maybeIssueCertificate(userId, courseId) {
  const lessons = db
    .prepare('SELECT COUNT(*) as c FROM lessons WHERE course_id = ?')
    .get(courseId).c;
  if (!lessons) return null;

  const done = db
    .prepare(
      `SELECT COUNT(*) as c FROM lesson_progress lp
       JOIN lessons l ON l.id = lp.lesson_id
       WHERE lp.user_id = ? AND l.course_id = ? AND lp.completed = 1`
    )
    .get(userId, courseId).c;
  if (done < lessons) return null;

  const course = db.prepare('SELECT title FROM courses WHERE id = ?').get(courseId);
  const existing = db
    .prepare('SELECT * FROM certificates WHERE user_id = ? AND course_id = ?')
    .get(userId, courseId);
  if (existing) return existing;

  const info = db
    .prepare(
      `INSERT INTO certificates (user_id, course_id, title)
       VALUES (?, ?, ?)`
    )
    .run(userId, courseId, `Сертификат: ${course.title}`);
  return db.prepare('SELECT * FROM certificates WHERE id = ?').get(info.lastInsertRowid);
}

module.exports = { maybeIssueCertificate };
