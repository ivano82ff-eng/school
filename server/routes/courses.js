const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();

function courseWithMeta(course, userId) {
  const lessonsCount = db
    .prepare('SELECT COUNT(*) as c FROM lessons WHERE course_id = ?')
    .get(course.id).c;
  let enrolled = false;
  let completedLessons = 0;
  if (userId) {
    enrolled = !!db
      .prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(userId, course.id);
    completedLessons = db
      .prepare(
        `SELECT COUNT(*) as c FROM lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         WHERE lp.user_id = ? AND l.course_id = ? AND lp.completed = 1`
      )
      .get(userId, course.id).c;
  }
  return { ...course, lessonsCount, enrolled, completedLessons };
}

router.get('/', (req, res) => {
  const { grade, category, q } = req.query;
  let sql = 'SELECT * FROM courses WHERE published = 1';
  const params = [];

  if (grade) {
    sql += ' AND grade_min <= ? AND grade_max >= ?';
    params.push(Number(grade), Number(grade));
  }
  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY grade_min, title';

  const userId = req.headers.authorization ? tryUserId(req) : null;
  const courses = db.prepare(sql).all(...params).map((c) => courseWithMeta(c, userId));
  res.json({ courses });
});

function tryUserId(req) {
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET).id;
  } catch {
    return null;
  }
}

router.get('/categories', (_req, res) => {
  const rows = db
    .prepare('SELECT DISTINCT category FROM courses WHERE published = 1 ORDER BY category')
    .all();
  res.json({ categories: rows.map((r) => r.category) });
});

router.get('/me/enrolled', authRequired, (req, res) => {
  const courses = db
    .prepare(
      `SELECT c.* FROM courses c
       JOIN enrollments e ON e.course_id = c.id
       WHERE e.user_id = ?
       ORDER BY e.enrolled_at DESC`
    )
    .all(req.user.id)
    .map((c) => courseWithMeta(c, req.user.id));
  res.json({ courses });
});

router.get('/:id', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course || !course.published) {
    return res.status(404).json({ error: 'Курс не найден' });
  }
  const userId = tryUserId(req);
  const lessons = db
    .prepare('SELECT id, title, sort_order, duration_min FROM lessons WHERE course_id = ? ORDER BY sort_order, id')
    .all(course.id);

  let progress = [];
  if (userId) {
    progress = db
      .prepare(
        `SELECT lesson_id, completed FROM lesson_progress
         WHERE user_id = ? AND lesson_id IN (SELECT id FROM lessons WHERE course_id = ?)`
      )
      .all(userId, course.id);
  }

  const materials = db
    .prepare(
      `SELECT id, title, url, description, sort_order
       FROM course_materials WHERE course_id = ?
       ORDER BY sort_order, id`
    )
    .all(course.id);

  res.json({
    course: courseWithMeta(course, userId),
    lessons: lessons.map((l) => ({
      ...l,
      completed: !!progress.find((p) => p.lesson_id === l.id && p.completed),
    })),
    materials,
  });
});

router.post('/:id/enroll', authRequired, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND published = 1').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });

  db.prepare(
    'INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)'
  ).run(req.user.id, course.id);

  res.json({ ok: true });
});

router.post('/', authRequired, requirePermission('content.builder', 'content.teach'), (req, res) => {
  const {
    title,
    description,
    grade_min = 1,
    grade_max = 11,
    category,
    cover_color = '#2563eb',
    icon = '💻',
  } = req.body || {};

  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Заполните название, описание и категорию' });
  }

  const info = db
    .prepare(
      `INSERT INTO courses (title, description, grade_min, grade_max, category, cover_color, icon, teacher_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      description,
      Number(grade_min),
      Number(grade_max),
      category,
      cover_color,
      icon,
      req.user.id
    );

  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ course });
});

router.put('/:id', authRequired, requirePermission('content.builder', 'content.teach'), (req, res) => {
  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Курс не найден' });

  const {
    title = existing.title,
    description = existing.description,
    grade_min = existing.grade_min,
    grade_max = existing.grade_max,
    category = existing.category,
    cover_color = existing.cover_color,
    icon = existing.icon,
    published = existing.published,
  } = req.body || {};

  db.prepare(
    `UPDATE courses SET title=?, description=?, grade_min=?, grade_max=?, category=?,
     cover_color=?, icon=?, published=? WHERE id=?`
  ).run(title, description, grade_min, grade_max, category, cover_color, icon, published ? 1 : 0, existing.id);

  res.json({ course: db.prepare('SELECT * FROM courses WHERE id = ?').get(existing.id) });
});

router.delete('/:id', authRequired, requirePermission('content.builder'), (req, res) => {
  db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
