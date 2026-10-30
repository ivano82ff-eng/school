const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('office.materials')];

router.get('/course/:courseId', (req, res) => {
  const course = db.prepare('SELECT id, published FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course || !course.published) {
    return res.status(404).json({ error: 'Курс не найден' });
  }
  const materials = db
    .prepare(
      `SELECT m.*, u.name as author_name
       FROM course_materials m
       LEFT JOIN users u ON u.id = m.created_by
       WHERE m.course_id = ?
       ORDER BY m.sort_order, m.id`
    )
    .all(course.id);
  res.json({ materials });
});

router.get('/', ...staff, (req, res) => {
  const courseId = req.query.course_id ? Number(req.query.course_id) : null;
  let materials;
  if (courseId) {
    materials = db
      .prepare(
        `SELECT m.*, c.title as course_title
         FROM course_materials m
         JOIN courses c ON c.id = m.course_id
         WHERE m.course_id = ?
         ORDER BY m.sort_order, m.id`
      )
      .all(courseId);
  } else {
    materials = db
      .prepare(
        `SELECT m.*, c.title as course_title
         FROM course_materials m
         JOIN courses c ON c.id = m.course_id
         ORDER BY c.title, m.sort_order, m.id`
      )
      .all();
  }
  res.json({ materials });
});

router.post('/', ...staff, (req, res) => {
  const courseId = Number(req.body?.course_id);
  const title = (req.body?.title || '').trim();
  const url = (req.body?.url || '').trim() || null;
  const description = (req.body?.description || '').trim();
  const sortOrder = Number(req.body?.sort_order) || 0;

  if (!courseId || !title) {
    return res.status(400).json({ error: 'Нужны course_id и title' });
  }
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });

  const id = db
    .prepare(
      `INSERT INTO course_materials (course_id, title, url, description, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(courseId, title, url, description, sortOrder, req.user.id).lastInsertRowid;

  res.status(201).json({
    material: db.prepare('SELECT * FROM course_materials WHERE id = ?').get(id),
  });
});

router.delete('/:id', ...staff, (req, res) => {
  const info = db.prepare('DELETE FROM course_materials WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Материал не найден' });
  res.json({ ok: true });
});

module.exports = router;
