const fs = require('fs');
const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { absolutePath } = require('../services/content');

const router = express.Router();
const editors = [authRequired, requirePermission('content.builder', 'content.teach')];

function parseSettings(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function lessonKind(lesson) {
  return parseSettings(lesson.settings_json).kind === 'test' ? 'test' : 'lesson';
}

function loadCourse(id) {
  return db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
}

function questionsFor(lessonId) {
  const quiz = db.prepare('SELECT id, title FROM quizzes WHERE lesson_id = ?').get(lessonId);
  if (!quiz) return [];
  return db
    .prepare(
      'SELECT id, question, options, correct_index FROM quiz_questions WHERE quiz_id = ? ORDER BY id'
    )
    .all(quiz.id)
    .map((q) => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options),
      correct_index: q.correct_index,
    }));
}

function lessonBlock(lesson) {
  const type = lessonKind(lesson);
  const block = {
    key: `${type}:${lesson.id}`,
    type,
    id: lesson.id,
    title: lesson.title,
    sort_order: lesson.sort_order,
  };
  if (type === 'test') return { ...block, questions: questionsFor(lesson.id) };
  return { ...block, content: lesson.content, duration_min: lesson.duration_min };
}

function materialBlock(row) {
  return {
    key: `material:${row.id}`,
    type: 'material',
    id: row.id,
    title: row.title,
    description: row.description || '',
    url: row.url,
    file_id: row.file_id || null,
    original_name: row.original_name || null,
    sort_order: row.sort_order,
  };
}

function collectBlocks(course) {
  const lessons = db
    .prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order, id')
    .all(course.id);
  const materials = db
    .prepare(
      `SELECT m.*, f.original_name
       FROM course_materials m
       LEFT JOIN files f ON f.id = m.file_id
       WHERE m.course_id = ?
       ORDER BY m.sort_order, m.id`
    )
    .all(course.id);
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const materialById = new Map(materials.map((row) => [row.id, row]));
  const outline = parseSettings(course.settings_json).outline;
  const blocks = [];
  const used = new Set();

  if (Array.isArray(outline)) {
    for (const item of outline) {
      const id = Number(item.id);
      if (item.type === 'material' && materialById.has(id)) {
        blocks.push(materialBlock(materialById.get(id)));
        used.add(`material:${id}`);
      } else if ((item.type === 'lesson' || item.type === 'test') && lessonById.has(id)) {
        const lesson = lessonById.get(id);
        blocks.push(lessonBlock(lesson));
        used.add(`lesson:${lesson.id}`);
      }
    }
  }

  for (const lesson of lessons) {
    if (!used.has(`lesson:${lesson.id}`)) blocks.push(lessonBlock(lesson));
  }
  for (const row of materials) {
    if (!used.has(`material:${row.id}`)) blocks.push(materialBlock(row));
  }
  return blocks;
}

function writeOutline(course, outline) {
  const settings = parseSettings(course.settings_json);
  settings.outline = outline;
  db.prepare('UPDATE courses SET settings_json = ? WHERE id = ?').run(
    JSON.stringify(settings),
    course.id
  );
  let lessonOrder = 0;
  let materialOrder = 0;
  for (const item of outline) {
    if (item.type === 'lesson' || item.type === 'test') {
      db.prepare('UPDATE lessons SET sort_order = ? WHERE id = ? AND course_id = ?').run(
        lessonOrder,
        item.id,
        course.id
      );
      lessonOrder += 1;
    } else if (item.type === 'material') {
      db.prepare(
        'UPDATE course_materials SET sort_order = ? WHERE id = ? AND course_id = ?'
      ).run(materialOrder, item.id, course.id);
      materialOrder += 1;
    }
  }
}

function persistCollected(course) {
  const fresh = loadCourse(course.id);
  const blocks = collectBlocks(fresh);
  writeOutline(
    fresh,
    blocks.map((block) => ({ type: block.type, id: block.id }))
  );
  return collectBlocks(loadCourse(course.id));
}

function publicCourse(course) {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    grade_min: course.grade_min,
    grade_max: course.grade_max,
    category: course.category,
    cover_color: course.cover_color,
    icon: course.icon,
    published: course.published,
  };
}

function normalizeQuestions(input) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const questions = [];
  for (const raw of input) {
    const question = String(raw?.question || '').trim();
    const options = (Array.isArray(raw?.options) ? raw.options : [])
      .map((option) => String(option).trim())
      .filter(Boolean);
    if (!question || options.length < 2) return null;
    let correct = Number(raw.correct_index);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) correct = 0;
    questions.push({ question, options, correct_index: correct });
  }
  return questions;
}

function saveQuiz(lessonId, title, questions) {
  let quiz = db.prepare('SELECT id FROM quizzes WHERE lesson_id = ?').get(lessonId);
  if (!quiz) {
    const id = db
      .prepare('INSERT INTO quizzes (lesson_id, title) VALUES (?, ?)')
      .run(lessonId, title).lastInsertRowid;
    quiz = { id };
  } else {
    db.prepare('UPDATE quizzes SET title = ? WHERE id = ?').run(title, quiz.id);
    db.prepare('DELETE FROM quiz_questions WHERE quiz_id = ?').run(quiz.id);
  }
  const insert = db.prepare(
    'INSERT INTO quiz_questions (quiz_id, question, options, correct_index) VALUES (?, ?, ?, ?)'
  );
  for (const question of questions) {
    insert.run(quiz.id, question.question, JSON.stringify(question.options), question.correct_index);
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
    // ignore a missing upload
  }
  db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
}

router.get('/courses', ...editors, (_req, res) => {
  const courses = db
    .prepare(
      `SELECT id, title, icon, published, category
       FROM courses
       ORDER BY id DESC`
    )
    .all();
  res.json({ courses });
});

router.post('/courses', ...editors, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const description = String(req.body?.description || '').trim();
  const category = String(req.body?.category || '').trim();
  const gradeMin = Number(req.body?.grade_min ?? 1);
  const gradeMax = Number(req.body?.grade_max ?? 11);
  const cover = String(req.body?.cover_color || '#2563eb');
  const icon = String(req.body?.icon || '💻').slice(0, 8) || '💻';
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Заполните название, описание и категорию' });
  }
  if (gradeMin < 1 || gradeMax > 11 || gradeMin > gradeMax) {
    return res.status(400).json({ error: 'Класс должен быть от 1 до 11' });
  }

  const id = db
    .prepare(
      `INSERT INTO courses
        (title, description, grade_min, grade_max, category, cover_color, icon, published, teacher_id, settings_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    )
    .run(
      title,
      description,
      gradeMin,
      gradeMax,
      category,
      cover,
      icon,
      req.user.id,
      JSON.stringify({ outline: [] })
    ).lastInsertRowid;

  const course = loadCourse(id);
  res.status(201).json({ course: publicCourse(course), blocks: [] });
});

router.get('/courses/:id', ...editors, (req, res) => {
  const course = loadCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });
  res.json({ course: publicCourse(course), blocks: collectBlocks(course) });
});

router.patch('/courses/:id', ...editors, (req, res) => {
  const course = loadCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });

  const title = req.body.title != null ? String(req.body.title).trim() : course.title;
  const description =
    req.body.description != null ? String(req.body.description).trim() : course.description;
  const category = req.body.category != null ? String(req.body.category).trim() : course.category;
  const gradeMin = req.body.grade_min != null ? Number(req.body.grade_min) : course.grade_min;
  const gradeMax = req.body.grade_max != null ? Number(req.body.grade_max) : course.grade_max;
  const cover = req.body.cover_color != null ? String(req.body.cover_color) : course.cover_color;
  const icon = req.body.icon != null ? String(req.body.icon).slice(0, 8) : course.icon;
  const published = req.body.published != null ? (req.body.published ? 1 : 0) : course.published;
  if (!title || !description || !category) {
    return res.status(400).json({ error: 'Заполните название, описание и категорию' });
  }
  if (gradeMin < 1 || gradeMax > 11 || gradeMin > gradeMax) {
    return res.status(400).json({ error: 'Класс должен быть от 1 до 11' });
  }

  db.prepare(
    `UPDATE courses
     SET title=?, description=?, grade_min=?, grade_max=?, category=?, cover_color=?, icon=?, published=?
     WHERE id=?`
  ).run(title, description, gradeMin, gradeMax, category, cover, icon, published, course.id);

  res.json({ course: publicCourse(loadCourse(course.id)) });
});

router.post('/courses/:id/blocks', ...editors, (req, res) => {
  const course = loadCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });
  const type = req.body?.type;
  if (!['lesson', 'test', 'material'].includes(type)) {
    return res.status(400).json({ error: 'Тип блока: lesson, test или material' });
  }

  db.exec('BEGIN');
  try {
    if (type === 'lesson') {
      const title = String(req.body.title || 'Новый урок').trim() || 'Новый урок';
      const content = req.body.content != null ? String(req.body.content) : 'Текст урока';
      const duration = Number(req.body.duration_min) || 20;
      db.prepare(
        `INSERT INTO lessons (course_id, title, content, sort_order, duration_min, settings_json)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(course.id, title, content, 0, duration, JSON.stringify({ kind: 'lesson' }));
    } else if (type === 'test') {
      const title = String(req.body.title || 'Проверочная').trim() || 'Проверочная';
      const questions =
        normalizeQuestions(req.body.questions) ||
        normalizeQuestions([
          { question: 'Новый вопрос', options: ['Вариант 1', 'Вариант 2'], correct_index: 0 },
        ]);
      const lessonId = db
        .prepare(
          `INSERT INTO lessons (course_id, title, content, sort_order, duration_min, settings_json)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          course.id,
          title,
          'Ответьте на вопросы проверочной.',
          0,
          10,
          JSON.stringify({ kind: 'test' })
        ).lastInsertRowid;
      saveQuiz(lessonId, title, questions);
    } else {
      const title = String(req.body.title || 'Новый материал').trim() || 'Новый материал';
      const description = String(req.body.description || '').trim();
      const url = String(req.body.url || '').trim() || null;
      db.prepare(
        `INSERT INTO course_materials (course_id, title, url, description, sort_order, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(course.id, title, url, description, 0, req.user.id);
    }
    const blocks = persistCollected(course);
    db.exec('COMMIT');
    res.status(201).json({ blocks });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
});

router.patch('/courses/:courseId/blocks/:type/:id', ...editors, (req, res) => {
  const course = loadCourse(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });
  const id = Number(req.params.id);
  const type = req.params.type;

  if (type === 'lesson' || type === 'test') {
    const lesson = db
      .prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ?')
      .get(id, course.id);
    if (!lesson || lessonKind(lesson) !== type) {
      return res.status(404).json({ error: 'Блок не найден' });
    }
    const title = req.body.title != null ? String(req.body.title).trim() : lesson.title;
    if (!title) return res.status(400).json({ error: 'Нужно название' });
    if (type === 'lesson') {
      const content = req.body.content != null ? String(req.body.content) : lesson.content;
      const duration =
        req.body.duration_min != null ? Number(req.body.duration_min) || 20 : lesson.duration_min;
      db.prepare('UPDATE lessons SET title=?, content=?, duration_min=? WHERE id=?').run(
        title,
        content,
        duration,
        lesson.id
      );
    } else if (req.body.questions != null || req.body.title != null) {
      const questions =
        req.body.questions != null ? normalizeQuestions(req.body.questions) : questionsFor(lesson.id);
      if (!questions) {
        return res.status(400).json({ error: 'В проверочной нужен вопрос и минимум два варианта' });
      }
      db.prepare(
        `UPDATE lessons SET title=?, content=? WHERE id=?`
      ).run(title, 'Ответьте на вопросы проверочной.', lesson.id);
      saveQuiz(lesson.id, title, questions);
    }
  } else if (type === 'material') {
    const row = db
      .prepare('SELECT * FROM course_materials WHERE id = ? AND course_id = ?')
      .get(id, course.id);
    if (!row) return res.status(404).json({ error: 'Блок не найден' });
    const title = req.body.title != null ? String(req.body.title).trim() : row.title;
    const description =
      req.body.description != null ? String(req.body.description).trim() : row.description;
    const url = req.body.url !== undefined ? String(req.body.url || '').trim() || null : row.url;
    let fileId = row.file_id;
    if (req.body.file_id !== undefined) {
      fileId = req.body.file_id ? Number(req.body.file_id) : null;
      if (fileId && !db.prepare('SELECT id FROM files WHERE id = ?').get(fileId)) {
        return res.status(404).json({ error: 'Файл не найден' });
      }
    }
    if (!title) return res.status(400).json({ error: 'Нужно название' });
    db.prepare(
      'UPDATE course_materials SET title=?, description=?, url=?, file_id=? WHERE id=?'
    ).run(title, description, url, fileId, row.id);
    if (row.file_id && row.file_id !== fileId) deleteStoredFile(row.file_id);
  } else {
    return res.status(400).json({ error: 'Неизвестный тип блока' });
  }

  res.json({ blocks: collectBlocks(loadCourse(course.id)) });
});

router.delete('/courses/:courseId/blocks/:type/:id', ...editors, (req, res) => {
  const course = loadCourse(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });
  const id = Number(req.params.id);
  const type = req.params.type;

  db.exec('BEGIN');
  try {
    if (type === 'lesson' || type === 'test') {
      const lesson = db
        .prepare('SELECT * FROM lessons WHERE id = ? AND course_id = ?')
        .get(id, course.id);
      if (!lesson || lessonKind(lesson) !== type) {
        db.exec('ROLLBACK');
        return res.status(404).json({ error: 'Блок не найден' });
      }
      db.prepare('DELETE FROM lessons WHERE id = ?').run(lesson.id);
    } else if (type === 'material') {
      const row = db
        .prepare('SELECT * FROM course_materials WHERE id = ? AND course_id = ?')
        .get(id, course.id);
      if (!row) {
        db.exec('ROLLBACK');
        return res.status(404).json({ error: 'Блок не найден' });
      }
      db.prepare('DELETE FROM course_materials WHERE id = ?').run(row.id);
      deleteStoredFile(row.file_id);
    } else {
      db.exec('ROLLBACK');
      return res.status(400).json({ error: 'Неизвестный тип блока' });
    }
    const blocks = persistCollected(course);
    db.exec('COMMIT');
    res.json({ blocks });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
});

router.post('/courses/:id/reorder', ...editors, (req, res) => {
  const course = loadCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });
  const blocks = collectBlocks(course);
  const order = Array.isArray(req.body?.order) ? req.body.order : null;
  if (!order || order.length !== blocks.length) {
    return res.status(400).json({ error: 'Передайте полный порядок блоков' });
  }
  const have = new Set(blocks.map((block) => `${block.type}:${block.id}`));
  const seen = new Set();
  const next = [];
  for (const item of order) {
    const type = item?.type;
    const id = Number(item?.id);
    const key = `${type}:${id}`;
    if (!have.has(key) || seen.has(key)) {
      return res.status(400).json({ error: 'Порядок не совпадает с блоками курса' });
    }
    seen.add(key);
    next.push({ type, id });
  }
  writeOutline(course, next);
  res.json({ blocks: collectBlocks(loadCourse(course.id)) });
});

module.exports = router;
