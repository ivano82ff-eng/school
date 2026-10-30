const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const {
  listAllRoles,
  listPermissions,
  permissionsForRole,
  setRolePermissions,
  getRole,
  hasPermission,
} = require('../services/rbac');

const router = express.Router();

router.use(authRequired);

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    grade: row.grade,
    avatar: row.avatar,
    active: row.active !== 0,
    created_at: row.created_at,
    permissions: permissionsForRole(row.role),
  };
}

router.get('/bootstrap', requirePermission('admin.users', 'admin.roles', '*'), (_req, res) => {
  res.json({
    roles: listAllRoles(),
    permissions: listPermissions(),
  });
});

router.get('/users', requirePermission('admin.users', '*'), (req, res) => {
  const q = (req.query.q || '').trim();
  const role = req.query.role || null;
  let sql = `SELECT id, email, name, role, grade, avatar, active, created_at FROM users WHERE 1=1`;
  const params = [];
  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR email LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY created_at DESC LIMIT 300';
  const users = db.prepare(sql).all(...params).map(publicUser);
  res.json({ users });
});

router.post('/users', requirePermission('admin.users', '*'), (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const name = (req.body?.name || '').trim();
  const password = req.body?.password || '';
  const role = (req.body?.role || 'student').trim();
  const grade = req.body?.grade != null ? Number(req.body.grade) : null;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Нужны email, name, password' });
  }
  if (!getRole(role)) return res.status(400).json({ error: 'Неизвестная роль' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль слишком короткий' });

  try {
    const id = db
      .prepare(
        `INSERT INTO users (email, password, name, role, grade, active)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .run(email, bcrypt.hashSync(password, 10), name, role, grade).lastInsertRowid;

    if (role === 'student' || role === 'parent') {
      db.prepare(
        `INSERT INTO contacts (type, name, email, grade, user_id) VALUES (?, ?, ?, ?, ?)`
      ).run(role, name, email, grade, id);
    }

    res.status(201).json({
      user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)),
    });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email уже занят' });
    }
    throw e;
  }
});

router.patch('/users/:id', requirePermission('admin.users', '*'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const name = req.body.name != null ? String(req.body.name).trim() : user.name;
  const email =
    req.body.email != null ? String(req.body.email).trim().toLowerCase() : user.email;
  const role = req.body.role != null ? String(req.body.role).trim() : user.role;
  const grade = req.body.grade !== undefined ? req.body.grade : user.grade;
  const active =
    req.body.active !== undefined ? (req.body.active ? 1 : 0) : user.active !== 0 ? 1 : 0;

  if (!getRole(role)) return res.status(400).json({ error: 'Неизвестная роль' });
  if (user.role === 'admin' && role !== 'admin' && user.id === req.user.id) {
    return res.status(400).json({ error: 'Нельзя снять с себя роль admin' });
  }

  try {
    db.prepare(
      `UPDATE users SET name=?, email=?, role=?, grade=?, active=? WHERE id=?`
    ).run(name, email, role, grade, active, user.id);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email уже занят' });
    }
    throw e;
  }

  if (req.body.password) {
    if (String(req.body.password).length < 4) {
      return res.status(400).json({ error: 'Пароль слишком короткий' });
    }
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
      bcrypt.hashSync(String(req.body.password), 10),
      user.id
    );
  }

  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
});

router.get('/roles', requirePermission('admin.roles', 'admin.users', '*'), (_req, res) => {
  const roles = listAllRoles().map((r) => ({
    ...r,
    permissions: permissionsForRole(r.code),
  }));
  res.json({ roles, permissions: listPermissions() });
});

router.post('/roles', requirePermission('admin.roles', '*'), (req, res) => {
  const code = String(req.body?.code || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  const name = (req.body?.name || '').trim();
  const description = (req.body?.description || '').trim();
  if (!code || !name) return res.status(400).json({ error: 'Нужны code и name' });

  try {
    db.prepare(
      `INSERT INTO roles (code, name, description, is_system, active, sort_order)
       VALUES (?, ?, ?, 0, 1, 100)`
    ).run(code, name, description);
  } catch {
    return res.status(400).json({ error: 'Роль с таким code уже есть' });
  }

  const perms = Array.isArray(req.body?.permissions) ? req.body.permissions : [];
  if (perms.length) setRolePermissions(code, perms);

  res.status(201).json({
    role: { ...getRole(code), permissions: permissionsForRole(code) },
  });
});

router.patch('/roles/:code', requirePermission('admin.roles', '*'), (req, res) => {
  const role = getRole(req.params.code);
  if (!role) return res.status(404).json({ error: 'Роль не найдена' });

  const name = req.body.name != null ? String(req.body.name).trim() : role.name;
  const description =
    req.body.description != null ? String(req.body.description).trim() : role.description;
  const active =
    req.body.active !== undefined ? (req.body.active ? 1 : 0) : role.active;

  if (role.code === 'admin' && active === 0) {
    return res.status(400).json({ error: 'Нельзя отключить роль admin' });
  }

  db.prepare(`UPDATE roles SET name=?, description=?, active=? WHERE code=?`).run(
    name,
    description,
    active,
    role.code
  );

  if (Array.isArray(req.body.permissions)) {
    if (role.code === 'admin' && !req.body.permissions.includes('*')) {
      req.body.permissions = ['*', ...req.body.permissions];
    }
    setRolePermissions(role.code, req.body.permissions);
  }

  res.json({
    role: { ...getRole(role.code), permissions: permissionsForRole(role.code) },
  });
});

router.get('/me-access', (req, res) => {
  const role = getRole(req.user.role);
  const permissions = permissionsForRole(req.user.role);
  res.json({
    role,
    permissions,
    flags: {
      office: hasPermission(req.user.role, 'office.access'),
      admin: hasPermission(req.user.role, 'admin.users', 'admin.roles', '*'),
      content: hasPermission(req.user.role, 'content.teach', 'content.builder'),
      diary: hasPermission(req.user.role, 'diary.access'),
      diaryManage: hasPermission(req.user.role, 'diary.manage'),
      parent: hasPermission(req.user.role, 'parent.portal'),
      student: hasPermission(req.user.role, 'student.learn'),
      search: hasPermission(req.user.role, 'search.access'),
      messages: hasPermission(req.user.role, 'messages.access'),
      portfolio: hasPermission(req.user.role, 'portfolio.access'),
      documents: hasPermission(req.user.role, 'documents.access'),
    },
  });
});

module.exports = router;
