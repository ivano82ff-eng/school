const express = require('express');
const db = require('../db');
const { authRequired, requirePermission, userCan } = require('../middleware/auth');
const {
  studentContactByUser,
  parentContactByUser,
  childrenContactIds,
  canViewStudent,
} = require('../services/diary');

const router = express.Router();

function canEditProject(user, project) {
  if (!user || !project) return false;
  if (userCan(user, 'content.teach', 'content.builder')) return true;
  return project.user_id === user.id;
}

function canViewProject(user, project) {
  if (!project) return false;
  if (project.visibility === 'public' && project.status === 'published') return true;
  if (!user) return false;
  if (userCan(user, 'content.teach', 'content.builder', 'office.access')) return true;
  if (project.user_id === user.id) return true;
  if (user.role === 'parent' && project.contact_id) {
    return canViewStudent(user, project.contact_id);
  }
  if (project.visibility === 'school' && project.status === 'published') return true;
  return false;
}

function withMeta(p) {
  const owner = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(p.user_id);
  const course = p.course_id
    ? db.prepare('SELECT id, title, icon FROM courses WHERE id = ?').get(p.course_id)
    : null;
  return { ...p, owner, course };
}

router.get('/', authRequired, (req, res) => {
  const mine = req.query.mine === '1';
  const userId = req.query.user_id ? Number(req.query.user_id) : null;
  let rows;

  if (mine || req.user.role === 'student') {
    const uid = mine || req.user.role === 'student' ? req.user.id : userId;
    rows = db
      .prepare(
        `SELECT * FROM portfolio_projects WHERE user_id = ? ORDER BY updated_at DESC`
      )
      .all(uid || req.user.id);
  } else if (req.user.role === 'parent') {
    const parent = parentContactByUser(req.user.id);
    const kids = parent ? childrenContactIds(parent.id) : [];
    if (!kids.length) rows = [];
    else {
      rows = db
        .prepare(
          `SELECT * FROM portfolio_projects
           WHERE contact_id IN (${kids.map(() => '?').join(',')})
              OR user_id IN (SELECT user_id FROM contacts WHERE id IN (${kids.map(() => '?').join(',')}) AND user_id IS NOT NULL)
           ORDER BY updated_at DESC`
        )
        .all(...kids, ...kids);
    }
  } else {
    // staff: all published + drafts overview
    rows = db
      .prepare(`SELECT * FROM portfolio_projects ORDER BY updated_at DESC LIMIT 100`)
      .all();
  }

  res.json({
    projects: rows.filter((p) => canViewProject(req.user, p)).map(withMeta),
  });
});

router.get('/public', (_req, res) => {
  const projects = db
    .prepare(
      `SELECT * FROM portfolio_projects
       WHERE visibility = 'public' AND status = 'published'
       ORDER BY updated_at DESC LIMIT 50`
    )
    .all()
    .map(withMeta);
  res.json({ projects });
});

router.get('/:id', authRequired, (req, res) => {
  const project = db.prepare('SELECT * FROM portfolio_projects WHERE id = ?').get(req.params.id);
  if (!project || !canViewProject(req.user, project)) {
    return res.status(404).json({ error: 'Проект не найден' });
  }
  res.json({ project: withMeta(project) });
});

router.post('/', authRequired, (req, res) => {
  if (!['student', 'admin', 'teacher'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Портфолио создаёт ученик (или сотрудник от его имени)' });
  }

  const title = (req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'Нужен title' });

  let user_id = req.user.id;
  if ((req.user.role === 'admin' || req.user.role === 'teacher') && req.body?.user_id) {
    user_id = Number(req.body.user_id);
  }

  const contact = studentContactByUser(user_id);
  const description = (req.body?.description || '').trim();
  const url = (req.body?.url || '').trim() || null;
  const tech_stack = (req.body?.tech_stack || '').trim();
  const visibility = ['private', 'school', 'public'].includes(req.body?.visibility)
    ? req.body.visibility
    : 'school';
  const status = ['draft', 'published', 'archived'].includes(req.body?.status)
    ? req.body.status
    : 'draft';
  const course_id = req.body?.course_id ? Number(req.body.course_id) : null;

  const id = db
    .prepare(
      `INSERT INTO portfolio_projects
       (user_id, contact_id, course_id, title, description, url, tech_stack, visibility, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      user_id,
      contact?.id || null,
      course_id,
      title,
      description,
      url,
      tech_stack,
      visibility,
      status
    ).lastInsertRowid;

  res.status(201).json({
    project: withMeta(db.prepare('SELECT * FROM portfolio_projects WHERE id = ?').get(id)),
  });
});

router.patch('/:id', authRequired, (req, res) => {
  const project = db.prepare('SELECT * FROM portfolio_projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Не найдено' });
  if (!canEditProject(req.user, project)) return res.status(403).json({ error: 'Нет прав' });

  const title = req.body.title != null ? String(req.body.title).trim() : project.title;
  const description =
    req.body.description != null ? String(req.body.description).trim() : project.description;
  const url = req.body.url !== undefined ? (req.body.url || null) : project.url;
  const tech_stack =
    req.body.tech_stack != null ? String(req.body.tech_stack).trim() : project.tech_stack;
  const visibility = ['private', 'school', 'public'].includes(req.body.visibility)
    ? req.body.visibility
    : project.visibility;
  const status = ['draft', 'published', 'archived'].includes(req.body.status)
    ? req.body.status
    : project.status;
  const course_id =
    req.body.course_id !== undefined
      ? req.body.course_id
        ? Number(req.body.course_id)
        : null
      : project.course_id;

  db.prepare(
    `UPDATE portfolio_projects
     SET title=?, description=?, url=?, tech_stack=?, visibility=?, status=?, course_id=?,
         updated_at=datetime('now')
     WHERE id=?`
  ).run(title, description, url, tech_stack, visibility, status, course_id, project.id);

  res.json({
    project: withMeta(db.prepare('SELECT * FROM portfolio_projects WHERE id = ?').get(project.id)),
  });
});

router.delete('/:id', authRequired, (req, res) => {
  const project = db.prepare('SELECT * FROM portfolio_projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Не найдено' });
  if (!canEditProject(req.user, project)) return res.status(403).json({ error: 'Нет прав' });
  db.prepare('DELETE FROM portfolio_projects WHERE id = ?').run(project.id);
  res.json({ ok: true });
});

module.exports = router;
