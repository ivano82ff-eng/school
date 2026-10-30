const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../db');
const { authRequired, requirePermission, userCan } = require('../middleware/auth');
const { ensureUploadsDir, uploadsRoot, absolutePath, randomToken } = require('../services/content');

const router = express.Router();
const staff = [authRequired, requirePermission('office.materials')];
const courseAuthors = [authRequired, requirePermission('content.builder', 'content.teach')];

const MAX_BYTES = 40 * 1024 * 1024;
const ALLOWED_EXT = new Set([
  'ppt', 'pptx', 'key',
  'pdf',
  'mp4', 'webm', 'mov',
  'doc', 'docx', 'odt', 'txt', 'rtf',
  'xls', 'xlsx', 'csv',
  'png', 'jpg', 'jpeg', 'gif', 'webp',
  'zip',
]);
const TYPE_ERROR =
  'Этот тип файла не поддерживается. Загрузите презентацию (ppt, pptx, key), PDF, видео (mp4, webm, mov), документ (doc, docx, odt, txt, rtf), таблицу (xls, xlsx, csv), изображение (png, jpg, jpeg, gif, webp) или архив (zip).';

ensureUploadsDir();

function safeOriginalName(name) {
  const raw = String(name || '').replace(/\0/g, '').replace(/\\/g, '/');
  const base = path.posix.basename(raw).replace(/[/\\]/g, '').trim().slice(0, 180);
  return base || 'file';
}

function extOf(name) {
  const base = safeOriginalName(name);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadsDir();
    cb(null, uploadsRoot);
  },
  filename: (_req, file, cb) => {
    const ext = extOf(file.originalname);
    cb(null, `${Date.now()}-${randomToken(8)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_EXT.has(extOf(file.originalname))) {
      const err = new Error(TYPE_ERROR);
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

function acceptUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Файл больше 40 МБ. Выберите файл меньшего размера.' });
    }
    return res.status(400).json({ error: err.message || 'Не удалось принять файл' });
  });
}

function materialSelect() {
  return `SELECT m.id, m.course_id, m.title, m.url, m.description, m.sort_order, m.file_id,
            m.created_by, m.created_at, f.original_name, c.title as course_title
     FROM course_materials m
     JOIN courses c ON c.id = m.course_id
     LEFT JOIN files f ON f.id = m.file_id`;
}

function removeUploaded(file) {
  if (!file?.path) return;
  try {
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
  } catch {
    // ignore
  }
}

function deleteStoredFile(fileId) {
  if (!fileId) return;
  const still = db
    .prepare(
      `SELECT 1 AS ok FROM course_materials WHERE file_id = ?
       UNION ALL SELECT 1 FROM documents WHERE file_id = ?
       UNION ALL SELECT 1 FROM lesson_blocks WHERE file_id = ?`
    )
    .get(fileId, fileId, fileId);
  if (still) return;
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId);
  if (!file) return;
  try {
    const abs = absolutePath(file.storage_key);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
}

router.get('/course/:courseId', (req, res) => {
  const course = db.prepare('SELECT id, published FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course || !course.published) {
    return res.status(404).json({ error: 'Курс не найден' });
  }
  const materials = db
    .prepare(
      `${materialSelect()}
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
        `${materialSelect()}
         WHERE m.course_id = ?
         ORDER BY m.sort_order, m.id`
      )
      .all(courseId);
  } else {
    materials = db
      .prepare(
        `${materialSelect()}
         ORDER BY c.title, m.sort_order, m.id`
      )
      .all();
  }
  res.json({ materials });
});

router.post('/upload', ...courseAuthors, acceptUpload, (req, res) => {
  const courseId = Number(req.body?.course_id);
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  if (!courseId) {
    removeUploaded(req.file);
    return res.status(400).json({ error: 'Выберите курс' });
  }
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(courseId);
  if (!course) {
    removeUploaded(req.file);
    return res.status(404).json({ error: 'Курс не найден' });
  }

  const originalName = safeOriginalName(req.file.originalname);
  const ext = extOf(originalName);
  if (!ALLOWED_EXT.has(ext) || path.basename(req.file.filename) !== req.file.filename) {
    removeUploaded(req.file);
    return res.status(400).json({ error: TYPE_ERROR });
  }

  const title = (req.body?.title || '').trim() || originalName;
  const description = (req.body?.description || '').trim();
  const sortOrder = Number(req.body?.sort_order) || 0;

  const fileId = db
    .prepare(
      `INSERT INTO files (storage_key, original_name, mime, size, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      req.file.filename,
      originalName,
      req.file.mimetype || 'application/octet-stream',
      req.file.size || 0,
      req.user.id
    ).lastInsertRowid;

  const id = db
    .prepare(
      `INSERT INTO course_materials (course_id, title, url, description, sort_order, created_by, file_id)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`
    )
    .run(courseId, title, description, sortOrder, req.user.id, fileId).lastInsertRowid;

  const material = db.prepare(`${materialSelect()} WHERE m.id = ?`).get(id);
  res.status(201).json({ material });
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
    material: db.prepare(`${materialSelect()} WHERE m.id = ?`).get(id),
  });
});

router.get('/:id/file', authRequired, (req, res) => {
  const material = db
    .prepare(
      `SELECT m.id, m.file_id, c.published
       FROM course_materials m
       JOIN courses c ON c.id = m.course_id
       WHERE m.id = ?`
    )
    .get(req.params.id);
  if (!material?.file_id) return res.status(404).json({ error: 'Файл не найден' });
  if (!material.published && !userCan(req.user, 'content.teach', 'content.builder')) {
    return res.status(403).json({ error: 'Недостаточно прав для этого раздела' });
  }
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(material.file_id);
  if (!file) return res.status(404).json({ error: 'Файл не найден' });
  let abs;
  try {
    abs = absolutePath(file.storage_key);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Некорректное имя файла' });
  }
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Файл отсутствует на диске' });
  res.download(abs, safeOriginalName(file.original_name));
});

router.delete('/:id', ...staff, (req, res) => {
  const row = db.prepare('SELECT * FROM course_materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Материал не найден' });
  db.prepare('DELETE FROM course_materials WHERE id = ?').run(row.id);
  deleteStoredFile(row.file_id);
  res.json({ ok: true });
});

module.exports = router;
