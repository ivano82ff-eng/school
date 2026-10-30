const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const {
  ensureUploadsDir,
  uploadsRoot,
  absolutePath,
  randomToken,
} = require('../services/content');

ensureUploadsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, uploadsRoot);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 20);
    cb(null, `${Date.now()}-${randomToken(8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 },
});

const router = express.Router();
const staff = [authRequired, requirePermission('documents.access', 'content.builder', 'office.documents')];

function fileRow(id) {
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id);
}

router.post('/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });

  const id = db
    .prepare(
      `INSERT INTO files (storage_key, original_name, mime, size, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      req.file.filename,
      req.file.originalname,
      req.file.mimetype || 'application/octet-stream',
      req.file.size || 0,
      req.user.id
    ).lastInsertRowid;

  res.status(201).json({ file: fileRow(id) });
});

router.get('/:id', authRequired, (req, res) => {
  const file = fileRow(req.params.id);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });
  const abs = absolutePath(file.storage_key);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
  res.download(abs, file.original_name);
});

router.get('/:id/meta', authRequired, (req, res) => {
  const file = fileRow(req.params.id);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });
  res.json({ file });
});

router.delete('/:id', ...staff, (req, res) => {
  const file = fileRow(req.params.id);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });
  const abs = absolutePath(file.storage_key);
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
  res.json({ ok: true });
});

module.exports = router;
