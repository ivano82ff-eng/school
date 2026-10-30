const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/:id', authRequired, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

  const enrolled = db
    .prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(req.user.id, lesson.course_id);

  if (!enrolled && req.user.role === 'student') {
    return res.status(403).json({ error: 'Сначала запишитесь на курс' });
  }

  const quiz = db.prepare('SELECT id, title FROM quizzes WHERE lesson_id = ?').get(lesson.id);
  let questions = [];
  if (quiz) {
    questions = db
      .prepare('SELECT id, question, options FROM quiz_questions WHERE quiz_id = ? ORDER BY id')
      .all(quiz.id)
      .map((q) => ({ ...q, options: JSON.parse(q.options) }));
  }

  const progress = db
    .prepare('SELECT completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
    .get(req.user.id, lesson.id);

  const siblings = db
    .prepare('SELECT id, title, sort_order FROM lessons WHERE course_id = ? ORDER BY sort_order, id')
    .all(lesson.course_id);

  res.json({
    lesson,
    quiz: quiz ? { ...quiz, questions } : null,
    completed: !!(progress && progress.completed),
    siblings,
  });
});

router.post('/:id/complete', authRequired, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

  db.prepare(
    `INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1, completed_at = datetime('now')`
  ).run(req.user.id, lesson.id);

  let certificate = null;
  try {
    const { maybeIssueCertificate } = require('../services/certificates');
    certificate = maybeIssueCertificate(req.user.id, lesson.course_id);
    if (certificate) {
      const { notifyUser } = require('../services/notify');
      notifyUser(req.user.id, {
        title: 'Получен сертификат!',
        body: certificate.title,
        link: '/dashboard',
        type: 'certificate',
      });
    }
  } catch {
    // ignore
  }

  res.json({ ok: true, certificate });
});

router.post('/:id/quiz', authRequired, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

  const quiz = db.prepare('SELECT * FROM quizzes WHERE lesson_id = ?').get(lesson.id);
  if (!quiz) return res.status(404).json({ error: 'Теста нет' });

  const answers = req.body?.answers || {};
  const questions = db
    .prepare('SELECT id, correct_index FROM quiz_questions WHERE quiz_id = ?')
    .all(quiz.id);

  let score = 0;
  for (const q of questions) {
    if (Number(answers[q.id]) === q.correct_index) score += 1;
  }

  db.prepare(
    'INSERT INTO quiz_attempts (user_id, quiz_id, score, total) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, quiz.id, score, questions.length);

  if (score === questions.length && questions.length > 0) {
    db.prepare(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1, completed_at = datetime('now')`
    ).run(req.user.id, lesson.id);
  }

  res.json({ score, total: questions.length, passed: score === questions.length });
});

router.post('/', authRequired, requirePermission('content.builder', 'content.teach'), (req, res) => {
  const { course_id, title, content, sort_order = 0, duration_min = 20 } = req.body || {};
  if (!course_id || !title || !content) {
    return res.status(400).json({ error: 'Нужны course_id, title и content' });
  }
  const info = db
    .prepare(
      'INSERT INTO lessons (course_id, title, content, sort_order, duration_min) VALUES (?, ?, ?, ?, ?)'
    )
    .run(course_id, title, content, sort_order, duration_min);
  res.status(201).json({
    lesson: db.prepare('SELECT * FROM lessons WHERE id = ?').get(info.lastInsertRowid),
  });
});

module.exports = router;
