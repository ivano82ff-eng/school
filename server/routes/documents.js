const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { canViewStudent } = require('../services/diary');

const router = express.Router();
const staff = [authRequired, requirePermission('office.documents')];

function withFile(doc) {
  if (!doc) return doc;
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(doc.file_id);
  return { ...doc, file };
}

router.get('/', authRequired, (req, res) => {
  const { doc_type, entity_type, entity_id, contact_id, q } = req.query;
  let sql = `SELECT d.* FROM documents d WHERE 1=1`;
  const params = [];

  if (doc_type) {
    sql += ' AND d.doc_type = ?';
    params.push(doc_type);
  }
  if (entity_type) {
    sql += ' AND d.entity_type = ?';
    params.push(entity_type);
  }
  if (entity_id) {
    sql += ' AND d.entity_id = ?';
    params.push(Number(entity_id));
  }
  if (contact_id) {
    sql += ' AND d.contact_id = ?';
    params.push(Number(contact_id));
  }
  if (q) {
    sql += ' AND (d.title LIKE ? OR d.notes LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  // Access: staff all; parent/student filtered
  if (req.user.role === 'student' || req.user.role === 'parent') {
    const own = db
      .prepare(`SELECT id FROM contacts WHERE user_id = ?`)
      .all(req.user.id)
      .map((c) => c.id);
    if (req.user.role === 'parent') {
      const parent = db
        .prepare(`SELECT id FROM contacts WHERE user_id = ? AND type = 'parent'`)
        .get(req.user.id);
      if (parent) {
        const kids = db
          .prepare(`SELECT student_id FROM contact_links WHERE parent_id = ?`)
          .all(parent.id)
          .map((r) => r.student_id);
        own.push(...kids);
      }
    }
    if (!own.length) return res.json({ documents: [] });
    sql += ` AND (d.contact_id IN (${own.map(() => '?').join(',')})
      OR d.created_by = ?
      OR (d.entity_type = 'homework_submission' AND d.entity_id IN (
        SELECT hs.id FROM homework_submissions hs
        JOIN contacts c ON c.id = hs.contact_id WHERE c.user_id = ?
      )))`;
    params.push(...own, req.user.id, req.user.id);
  }

  sql += ' ORDER BY d.created_at DESC LIMIT 200';
  const documents = db.prepare(sql).all(...params).map(withFile);
  res.json({ documents });
});

router.post('/', authRequired, (req, res) => {
  const file_id = Number(req.body?.file_id);
  const title = (req.body?.title || '').trim();
  const doc_type = req.body?.doc_type || 'other';
  const entity_type = req.body?.entity_type || null;
  const entity_id = req.body?.entity_id != null ? Number(req.body.entity_id) : null;
  const contact_id = req.body?.contact_id != null ? Number(req.body.contact_id) : null;
  const notes = (req.body?.notes || '').trim();

  if (!file_id || !title) {
    return res.status(400).json({ error: 'Нужны file_id и title' });
  }
  const file = db.prepare('SELECT id FROM files WHERE id = ?').get(file_id);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });

  const allowedTypes = ['homework', 'contract', 'material', 'lesson_asset', 'other'];
  if (!allowedTypes.includes(doc_type)) {
    return res.status(400).json({ error: 'Некорректный doc_type' });
  }

  if (contact_id && req.user.role === 'parent' && !canViewStudent(req.user, contact_id)) {
    return res.status(403).json({ error: 'Нет доступа к контакту' });
  }
  if (doc_type === 'contract' && req.user.role === 'student') {
    return res.status(403).json({ error: 'Договоры загружает сотрудник или родитель' });
  }

  const id = db
    .prepare(
      `INSERT INTO documents
       (file_id, title, doc_type, entity_type, entity_id, contact_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      file_id,
      title,
      doc_type,
      entity_type,
      entity_id,
      contact_id,
      notes,
      req.user.id
    ).lastInsertRowid;

  res.status(201).json({
    document: withFile(db.prepare('SELECT * FROM documents WHERE id = ?').get(id)),
  });
});

router.delete('/:id', authRequired, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Не найдено' });
  if (
    req.user.role !== 'admin' &&
    req.user.role !== 'teacher' &&
    doc.created_by !== req.user.id
  ) {
    return res.status(403).json({ error: 'Нет прав' });
  }
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
  res.json({ ok: true });
});

/** Staff-only list of contracts */
router.get('/contracts/all', ...staff, (_req, res) => {
  const documents = db
    .prepare(
      `SELECT d.* FROM documents d WHERE d.doc_type = 'contract' ORDER BY d.created_at DESC`
    )
    .all()
    .map(withFile);
  res.json({ documents });
});

module.exports = router;
