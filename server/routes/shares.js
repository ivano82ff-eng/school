const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { randomToken, parseJson } = require('../services/content');

const router = express.Router();
const staff = [authRequired, requirePermission('content.builder')];

router.post('/', ...staff, (req, res) => {
  const target_type = req.body?.target_type;
  const target_id = Number(req.body?.target_id);
  const label = (req.body?.label || '').trim();
  const expires_at = req.body?.expires_at || null;
  const max_visits = req.body?.max_visits != null ? Number(req.body.max_visits) : null;

  if (!['course', 'section', 'lesson', 'block', 'document'].includes(target_type) || !target_id) {
    return res.status(400).json({ error: 'Нужны target_type и target_id' });
  }

  const token = randomToken(12);
  const id = db
    .prepare(
      `INSERT INTO share_links
       (token, target_type, target_id, label, expires_at, max_visits, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(token, target_type, target_id, label, expires_at, max_visits, req.user.id)
    .lastInsertRowid;

  const link = db.prepare('SELECT * FROM share_links WHERE id = ?').get(id);
  res.status(201).json({
    share: link,
    url_path: `/s/${token}`,
  });
});

router.get('/mine', ...staff, (req, res) => {
  const shares = db
    .prepare(
      `SELECT * FROM share_links WHERE created_by = ? ORDER BY created_at DESC LIMIT 100`
    )
    .all(req.user.id);
  res.json({ shares });
});

/** Public resolve — limited payload, optional auth for deeper access */
router.get('/:token', (req, res) => {
  const share = db.prepare('SELECT * FROM share_links WHERE token = ?').get(req.params.token);
  if (!share) return res.status(404).json({ error: 'Ссылка недействительна' });

  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Срок ссылки истёк' });
  }
  if (share.max_visits != null && share.visits >= share.max_visits) {
    return res.status(410).json({ error: 'Лимит переходов исчерпан' });
  }

  db.prepare('UPDATE share_links SET visits = visits + 1 WHERE id = ?').run(share.id);

  let payload = { type: share.target_type, id: share.target_id, label: share.label };

  if (share.target_type === 'course') {
    const course = db.prepare('SELECT id, title, description, slug, icon FROM courses WHERE id = ?').get(share.target_id);
    payload.course = course;
    payload.redirect = course ? `/courses/${course.id}` : null;
  } else if (share.target_type === 'lesson') {
    const lesson = db.prepare('SELECT id, title, course_id, slug FROM lessons WHERE id = ?').get(share.target_id);
    payload.lesson = lesson;
    payload.redirect = lesson ? `/lessons/${lesson.id}` : null;
  } else if (share.target_type === 'block') {
    const block = db.prepare('SELECT * FROM lesson_blocks WHERE id = ?').get(share.target_id);
    if (block) {
      payload.block = {
        id: block.id,
        type: block.type,
        title: block.title,
        slug: block.slug,
        content: block.content,
        config: parseJson(block.config_json, {}),
        lesson_id: block.lesson_id,
      };
      payload.redirect = `/lessons/${block.lesson_id}#block-${block.slug}`;
    }
  } else if (share.target_type === 'section') {
    const section = db.prepare('SELECT * FROM course_sections WHERE id = ?').get(share.target_id);
    payload.section = section;
    payload.redirect = section ? `/courses/${section.course_id}#section-${section.slug}` : null;
  } else if (share.target_type === 'document') {
    const doc = db.prepare('SELECT id, title, doc_type, file_id FROM documents WHERE id = ?').get(share.target_id);
    payload.document = doc;
    payload.redirect = doc ? `/office/documents` : null;
    payload.file_download = doc ? `/api/files/${doc.file_id}` : null;
  }

  res.json({ share: { token: share.token, label: share.label, visits: share.visits + 1 }, payload });
});

router.delete('/:id', ...staff, (req, res) => {
  const info = db
    .prepare('DELETE FROM share_links WHERE id = ? AND (created_by = ? OR ? = 1)')
    .run(req.params.id, req.user.id, req.user.role === 'admin' ? 1 : 0);
  if (!info.changes) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

module.exports = router;
