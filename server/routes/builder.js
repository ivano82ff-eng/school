const express = require('express');
const db = require('../db');
const { authRequired, requirePermission, userCan } = require('../middleware/auth');
const {
  BLOCK_TYPES,
  uniqueSlug,
  parseJson,
  slugify,
} = require('../services/content');
const { studentContactByUser } = require('../services/diary');

const router = express.Router();
const staff = [authRequired, requirePermission('content.builder')];

function ensureCourseSlug(course) {
  if (course.slug) return course;
  const slug = uniqueSlug(course.title, (s) =>
    db.prepare('SELECT 1 FROM courses WHERE slug = ? AND id != ?').get(s, course.id)
  );
  db.prepare('UPDATE courses SET slug = ? WHERE id = ?').run(slug, course.id);
  return { ...course, slug };
}

function ensureLessonSlug(lesson) {
  if (lesson.slug) return lesson;
  const slug = uniqueSlug(lesson.title, (s) =>
    db
      .prepare('SELECT 1 FROM lessons WHERE course_id = ? AND slug = ? AND id != ?')
      .get(lesson.course_id, s, lesson.id)
  );
  db.prepare('UPDATE lessons SET slug = ? WHERE id = ?').run(slug, lesson.id);
  return { ...lesson, slug };
}

function blockWithMeta(b) {
  const file = b.file_id
    ? db.prepare('SELECT id, original_name, mime, size FROM files WHERE id = ?').get(b.file_id)
    : null;
  const criteria = b.criteria_id
    ? db.prepare('SELECT id, code, name, direction FROM diary_criteria WHERE id = ?').get(b.criteria_id)
    : null;
  return {
    ...b,
    config: parseJson(b.config_json, {}),
    file,
    criteria,
  };
}

function getBlocks(lessonId, { includeHidden = false } = {}) {
  let sql = `SELECT * FROM lesson_blocks WHERE lesson_id = ?`;
  if (!includeHidden) sql += ' AND visible = 1';
  sql += ' ORDER BY sort_order, id';
  return db.prepare(sql).all(lessonId).map(blockWithMeta);
}

/** Full course tree for builder */
router.get('/courses/:courseId', authRequired, (req, res) => {
  let course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });
  course = ensureCourseSlug(course);

  const sections = db
    .prepare(
      `SELECT * FROM course_sections WHERE course_id = ? ORDER BY sort_order, id`
    )
    .all(course.id);

  const lessons = db
    .prepare(
      `SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order, id`
    )
    .all(course.id)
    .map((l) => {
      const lesson = ensureLessonSlug(l);
      return {
        ...lesson,
        settings: parseJson(lesson.settings_json, {}),
        blocks: getBlocks(lesson.id, {
          includeHidden: userCan(req.user, 'content.builder', 'content.teach'),
        }),
      };
    });

  const criteria = db.prepare('SELECT id, code, name FROM diary_criteria ORDER BY name').all();

  res.json({
    course: { ...course, settings: parseJson(course.settings_json, {}) },
    sections,
    lessons,
    block_types: BLOCK_TYPES,
    criteria,
  });
});

router.patch('/courses/:courseId', ...staff, (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });

  const title = req.body.title != null ? String(req.body.title).trim() : course.title;
  const description =
    req.body.description != null ? String(req.body.description).trim() : course.description;
  let slug = req.body.slug != null ? slugify(req.body.slug) : course.slug;
  if (!slug) slug = uniqueSlug(title, (s) =>
    db.prepare('SELECT 1 FROM courses WHERE slug = ? AND id != ?').get(s, course.id)
  );
  const settings_json =
    req.body.settings != null ? JSON.stringify(req.body.settings) : course.settings_json;

  db.prepare(
    `UPDATE courses SET title=?, description=?, slug=?, settings_json=? WHERE id=?`
  ).run(title, description, slug, settings_json, course.id);

  res.json({ course: db.prepare('SELECT * FROM courses WHERE id = ?').get(course.id) });
});

router.post('/courses/:courseId/sections', ...staff, (req, res) => {
  const courseId = Number(req.params.courseId);
  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Нужен title' });
  const slug = uniqueSlug(req.body.slug || title, (s) =>
    db.prepare('SELECT 1 FROM course_sections WHERE course_id = ? AND slug = ?').get(courseId, s)
  );
  const sort_order = Number(req.body?.sort_order) || 0;
  const description = (req.body?.description || '').trim();

  const id = db
    .prepare(
      `INSERT INTO course_sections (course_id, title, slug, description, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(courseId, title, slug, description, sort_order).lastInsertRowid;

  res.status(201).json({
    section: db.prepare('SELECT * FROM course_sections WHERE id = ?').get(id),
  });
});

router.patch('/sections/:id', ...staff, (req, res) => {
  const section = db.prepare('SELECT * FROM course_sections WHERE id = ?').get(req.params.id);
  if (!section) return res.status(404).json({ error: 'Раздел не найден' });
  const title = req.body.title != null ? String(req.body.title).trim() : section.title;
  const description =
    req.body.description != null ? String(req.body.description).trim() : section.description;
  const sort_order =
    req.body.sort_order != null ? Number(req.body.sort_order) : section.sort_order;
  const published =
    req.body.published != null ? (req.body.published ? 1 : 0) : section.published;
  let slug = section.slug;
  if (req.body.slug != null) {
    slug = uniqueSlug(req.body.slug || title, (s) =>
      db
        .prepare('SELECT 1 FROM course_sections WHERE course_id = ? AND slug = ? AND id != ?')
        .get(section.course_id, s, section.id)
    );
  }
  db.prepare(
    `UPDATE course_sections SET title=?, slug=?, description=?, sort_order=?, published=? WHERE id=?`
  ).run(title, slug, description, sort_order, published, section.id);
  res.json({ section: db.prepare('SELECT * FROM course_sections WHERE id = ?').get(section.id) });
});

router.delete('/sections/:id', ...staff, (req, res) => {
  db.prepare('UPDATE lessons SET section_id = NULL WHERE section_id = ?').run(req.params.id);
  const info = db.prepare('DELETE FROM course_sections WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

router.post('/courses/:courseId/lessons', ...staff, (req, res) => {
  const course_id = Number(req.params.courseId);
  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Нужен title' });
  const content = req.body?.content || '';
  const sort_order = Number(req.body?.sort_order) || 0;
  const duration_min = Number(req.body?.duration_min) || 20;
  const section_id = req.body?.section_id ? Number(req.body.section_id) : null;
  const summary = (req.body?.summary || '').trim();
  const slug = uniqueSlug(req.body.slug || title, (s) =>
    db.prepare('SELECT 1 FROM lessons WHERE course_id = ? AND slug = ?').get(course_id, s)
  );
  const settings_json = JSON.stringify(req.body?.settings || {});

  const id = db
    .prepare(
      `INSERT INTO lessons
       (course_id, title, content, sort_order, duration_min, slug, section_id, summary, settings_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      course_id,
      title,
      content,
      sort_order,
      duration_min,
      slug,
      section_id,
      summary,
      settings_json
    ).lastInsertRowid;

  // Seed default markdown block from content if provided
  if (content) {
    db.prepare(
      `INSERT INTO lesson_blocks (lesson_id, type, title, slug, content, sort_order)
       VALUES (?, 'markdown', 'Содержание', 'content', ?, 0)`
    ).run(id, content);
  }

  res.status(201).json({
    lesson: db.prepare('SELECT * FROM lessons WHERE id = ?').get(id),
  });
});

router.patch('/lessons/:id', ...staff, (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

  const title = req.body.title != null ? String(req.body.title).trim() : lesson.title;
  const content = req.body.content != null ? String(req.body.content) : lesson.content;
  const sort_order =
    req.body.sort_order != null ? Number(req.body.sort_order) : lesson.sort_order;
  const duration_min =
    req.body.duration_min != null ? Number(req.body.duration_min) : lesson.duration_min;
  const section_id =
    req.body.section_id !== undefined
      ? req.body.section_id
        ? Number(req.body.section_id)
        : null
      : lesson.section_id;
  const summary = req.body.summary != null ? String(req.body.summary).trim() : lesson.summary;
  let slug = lesson.slug;
  if (req.body.slug != null || req.body.title != null) {
    slug = uniqueSlug(req.body.slug || title, (s) =>
      db
        .prepare('SELECT 1 FROM lessons WHERE course_id = ? AND slug = ? AND id != ?')
        .get(lesson.course_id, s, lesson.id)
    );
  }
  const settings_json =
    req.body.settings != null ? JSON.stringify(req.body.settings) : lesson.settings_json;

  db.prepare(
    `UPDATE lessons
     SET title=?, content=?, sort_order=?, duration_min=?, slug=?, section_id=?, summary=?, settings_json=?
     WHERE id=?`
  ).run(
    title,
    content,
    sort_order,
    duration_min,
    slug,
    section_id,
    summary,
    settings_json,
    lesson.id
  );

  res.json({ lesson: db.prepare('SELECT * FROM lessons WHERE id = ?').get(lesson.id) });
});

router.post('/lessons/:lessonId/blocks', ...staff, (req, res) => {
  const lesson_id = Number(req.params.lessonId);
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lesson_id);
  if (!lesson) return res.status(404).json({ error: 'Урок не найден' });

  const type = req.body?.type;
  if (!BLOCK_TYPES.includes(type)) {
    return res.status(400).json({ error: `Тип блока: ${BLOCK_TYPES.join(', ')}` });
  }

  const title = (req.body?.title || type).trim();
  const slug = uniqueSlug(req.body?.slug || title, (s) =>
    db.prepare('SELECT 1 FROM lesson_blocks WHERE lesson_id = ? AND slug = ?').get(lesson_id, s)
  );
  const content = req.body?.content != null ? String(req.body.content) : '';
  const config_json = JSON.stringify(req.body?.config || {});
  const file_id = req.body?.file_id ? Number(req.body.file_id) : null;
  const criteria_id = req.body?.criteria_id ? Number(req.body.criteria_id) : null;
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM lesson_blocks WHERE lesson_id = ?')
    .get(lesson_id).m;
  const sort_order =
    req.body?.sort_order != null ? Number(req.body.sort_order) : maxOrder + 1;

  const id = db
    .prepare(
      `INSERT INTO lesson_blocks
       (lesson_id, type, title, slug, content, config_json, file_id, criteria_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      lesson_id,
      type,
      title,
      slug,
      content,
      config_json,
      file_id,
      criteria_id,
      sort_order
    ).lastInsertRowid;

  res.status(201).json({
    block: blockWithMeta(db.prepare('SELECT * FROM lesson_blocks WHERE id = ?').get(id)),
  });
});

router.patch('/blocks/:id', ...staff, (req, res) => {
  const block = db.prepare('SELECT * FROM lesson_blocks WHERE id = ?').get(req.params.id);
  if (!block) return res.status(404).json({ error: 'Блок не найден' });

  const type = req.body.type && BLOCK_TYPES.includes(req.body.type) ? req.body.type : block.type;
  const title = req.body.title != null ? String(req.body.title).trim() : block.title;
  let slug = block.slug;
  if (req.body.slug != null || req.body.title != null) {
    slug = uniqueSlug(req.body.slug || title, (s) =>
      db
        .prepare('SELECT 1 FROM lesson_blocks WHERE lesson_id = ? AND slug = ? AND id != ?')
        .get(block.lesson_id, s, block.id)
    );
  }
  const content = req.body.content != null ? String(req.body.content) : block.content;
  const config_json =
    req.body.config != null ? JSON.stringify(req.body.config) : block.config_json;
  const file_id =
    req.body.file_id !== undefined
      ? req.body.file_id
        ? Number(req.body.file_id)
        : null
      : block.file_id;
  const criteria_id =
    req.body.criteria_id !== undefined
      ? req.body.criteria_id
        ? Number(req.body.criteria_id)
        : null
      : block.criteria_id;
  const sort_order =
    req.body.sort_order != null ? Number(req.body.sort_order) : block.sort_order;
  const visible = req.body.visible != null ? (req.body.visible ? 1 : 0) : block.visible;

  db.prepare(
    `UPDATE lesson_blocks
     SET type=?, title=?, slug=?, content=?, config_json=?, file_id=?, criteria_id=?, sort_order=?, visible=?
     WHERE id=?`
  ).run(
    type,
    title,
    slug,
    content,
    config_json,
    file_id,
    criteria_id,
    sort_order,
    visible,
    block.id
  );

  res.json({
    block: blockWithMeta(db.prepare('SELECT * FROM lesson_blocks WHERE id = ?').get(block.id)),
  });
});

router.post('/lessons/:lessonId/blocks/reorder', ...staff, (req, res) => {
  const lessonId = Number(req.params.lessonId);
  const order = Array.isArray(req.body?.order) ? req.body.order : [];
  const upd = db.prepare('UPDATE lesson_blocks SET sort_order = ? WHERE id = ? AND lesson_id = ?');
  order.forEach((id, idx) => upd.run(idx, Number(id), lessonId));
  res.json({ blocks: getBlocks(lessonId, { includeHidden: true }) });
});

router.delete('/blocks/:id', ...staff, (req, res) => {
  const info = db.prepare('DELETE FROM lesson_blocks WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

/** Student/teacher view of lesson with blocks */
router.get('/lessons/:id/play', authRequired, (req, res) => {
  let lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Урок не найден' });
  lesson = ensureLessonSlug(lesson);

  const enrolled = db
    .prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND course_id = ?')
    .get(req.user.id, lesson.course_id);
  if (!enrolled && req.user.role === 'student') {
    return res.status(403).json({ error: 'Сначала запишитесь на курс' });
  }

  const course = ensureCourseSlug(
    db.prepare('SELECT * FROM courses WHERE id = ?').get(lesson.course_id)
  );
  const includeHidden = req.user.role === 'teacher' || req.user.role === 'admin';
  const blocks = getBlocks(lesson.id, { includeHidden });

  const legacyQuiz = db.prepare('SELECT id, title FROM quizzes WHERE lesson_id = ?').get(lesson.id);
  let questions = [];
  if (legacyQuiz) {
    questions = db
      .prepare('SELECT id, question, options FROM quiz_questions WHERE quiz_id = ? ORDER BY id')
      .all(legacyQuiz.id)
      .map((q) => ({ ...q, options: JSON.parse(q.options) }));
  }

  const progress = db
    .prepare('SELECT completed FROM lesson_progress WHERE user_id = ? AND lesson_id = ?')
    .get(req.user.id, lesson.id);

  const siblings = db
    .prepare('SELECT id, title, slug, sort_order, section_id FROM lessons WHERE course_id = ? ORDER BY sort_order, id')
    .all(lesson.course_id);

  const sections = db
    .prepare(`SELECT * FROM course_sections WHERE course_id = ? ORDER BY sort_order, id`)
    .all(lesson.course_id);

  const attempts = db
    .prepare(
      `SELECT block_id, score, total, created_at FROM block_quiz_attempts
       WHERE user_id = ? AND block_id IN (SELECT id FROM lesson_blocks WHERE lesson_id = ?)
       ORDER BY id DESC`
    )
    .all(req.user.id, lesson.id);

  res.json({
    course,
    lesson: { ...lesson, settings: parseJson(lesson.settings_json, {}) },
    blocks,
    sections,
    siblings,
    quiz: legacyQuiz ? { ...legacyQuiz, questions } : null,
    completed: !!(progress && progress.completed),
    quiz_attempts: attempts,
    deep_link: `/learn/${course.slug || course.id}/${lesson.slug || lesson.id}`,
  });
});

/** Submit quiz inside a block; optional diary grade */
router.post('/blocks/:id/quiz', authRequired, (req, res) => {
  const block = db.prepare('SELECT * FROM lesson_blocks WHERE id = ?').get(req.params.id);
  if (!block || block.type !== 'quiz') {
    return res.status(404).json({ error: 'Quiz-блок не найден' });
  }
  const config = parseJson(block.config_json, {});
  const questions = Array.isArray(config.questions) ? config.questions : [];
  if (!questions.length) return res.status(400).json({ error: 'В блоке нет вопросов' });

  const answers = req.body?.answers || {};
  let score = 0;
  questions.forEach((q, idx) => {
    const key = q.id != null ? String(q.id) : String(idx);
    if (Number(answers[key]) === Number(q.correct_index)) score += 1;
  });

  db.prepare(
    `INSERT INTO block_quiz_attempts (block_id, user_id, score, total, answers_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(block.id, req.user.id, score, questions.length, JSON.stringify(answers));

  let diaryEntry = null;
  if (block.criteria_id && config.auto_grade !== false) {
    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(block.lesson_id);
    const contact = studentContactByUser(req.user.id);
    const group = contact
      ? db
          .prepare(
            `SELECT g.id FROM groups g
             JOIN group_members gm ON gm.group_id = g.id
             WHERE gm.contact_id = ? AND g.course_id = ? AND gm.status = 'active'
             LIMIT 1`
          )
          .get(contact.id, lesson.course_id)
      : null;

    if (contact && group) {
      const maxScore = Number(config.max_score) || 5;
      const scaled = questions.length
        ? Math.round((score / questions.length) * maxScore * 10) / 10
        : 0;
      const { defaultPeriodKey } = require('../services/diary');
      const id = db
        .prepare(
          `INSERT INTO diary_entries
           (group_id, contact_id, criteria_id, score, max_score, title, detail, comment, period_key, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          group.id,
          contact.id,
          block.criteria_id,
          scaled,
          maxScore,
          `Тест: ${block.title}`,
          `Автооценка из блока урока «${lesson.title}»: ${score}/${questions.length}. ${block.content || ''}`.trim(),
          'Сгенерировано конструктором курса',
          defaultPeriodKey(),
          req.user.id
        ).lastInsertRowid;
      diaryEntry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(id);
    }
  }

  const passed = score === questions.length && questions.length > 0;
  if (passed && config.complete_lesson) {
    db.prepare(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed, completed_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed = 1, completed_at = datetime('now')`
    ).run(req.user.id, block.lesson_id);
  }

  res.json({
    score,
    total: questions.length,
    passed,
    diary_entry: diaryEntry,
  });
});

module.exports = router;
