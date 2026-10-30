const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authRequired, requirePermission, JWT_SECRET } = require('../middleware/auth');
const { permissionsForRole, hasPermission } = require('../services/rbac');
const { linkPortalContact } = require('../services/helpers');

const router = express.Router();

function publicUser(row) {
  const permissions = permissionsForRole(row.role);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    grade: row.grade,
    avatar: row.avatar,
    active: row.active !== 0,
    created_at: row.created_at,
    permissions,
    flags: {
      office: hasPermission(row.role, 'office.access'),
      admin: hasPermission(row.role, 'admin.users', 'admin.roles'),
      content: hasPermission(row.role, 'content.teach', 'content.builder'),
      diary: hasPermission(row.role, 'diary.access'),
      diaryManage: hasPermission(row.role, 'diary.manage'),
      parent: hasPermission(row.role, 'parent.portal'),
      student: hasPermission(row.role, 'student.learn'),
      search: hasPermission(row.role, 'search.access'),
      messages: hasPermission(row.role, 'messages.access'),
      portfolio: hasPermission(row.role, 'portfolio.access'),
      documents: hasPermission(row.role, 'documents.access'),
      marketing: hasPermission(row.role, 'marketing.landings'),
    },
  };
}

router.post('/register', (req, res) => {
  const { email, password, name, grade, role } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Укажите email, пароль и имя' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  }

  const allowedRole =
    role === 'teacher' ? 'teacher' : role === 'parent' ? 'parent' : 'student';
  const gradeNum = allowedRole === 'student' ? Number(grade) || null : null;
  if (allowedRole === 'student' && (gradeNum < 1 || gradeNum > 11)) {
    return res.status(400).json({ error: 'Класс должен быть от 1 до 11' });
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db
      .prepare(
        'INSERT INTO users (email, password, name, role, grade, active) VALUES (?, ?, ?, ?, ?, 1)'
      )
      .run(email.trim().toLowerCase(), hash, name.trim(), allowedRole, gradeNum);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

    if (allowedRole === 'parent' || allowedRole === 'student') {
      linkPortalContact(user);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '14d' }
    );
    res.status(201).json({ token, user: publicUser(user) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Такой email уже зарегистрирован' });
    }
    throw e;
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }
  if (user.active === 0) {
    return res.status(403).json({ error: 'Аккаунт отключён. Обратитесь к администратору' });
  }
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '14d' }
  );
  res.json({ token, user: publicUser(user) });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.active === 0) {
    return res.status(403).json({ error: 'Аккаунт отключён' });
  }
  res.json({ user: publicUser(user) });
});

router.get(
  '/stats',
  authRequired,
  requirePermission('content.teach', 'content.builder', 'office.access'),
  (_req, res) => {
    const students = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get().c;
    const courses = db.prepare('SELECT COUNT(*) as c FROM courses').get().c;
    const lessons = db.prepare('SELECT COUNT(*) as c FROM lessons').get().c;
    const enrollments = db.prepare('SELECT COUNT(*) as c FROM enrollments').get().c;
    res.json({ students, courses, lessons, enrollments });
  }
);

module.exports = router;
