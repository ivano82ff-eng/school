/**
 * Flexible RBAC: roles ↔ permissions. Admin can edit mappings at runtime.
 */

const db = require('../db');

const PERMISSIONS = [
  ['*', 'Полный доступ', 'system', 'Все действия'],
  ['office.access', 'Офис', 'office', 'Вход в раздел Офис'],
  ['office.dashboard', 'Обзор офиса', 'office', 'Дашборд'],
  ['office.leads', 'CRM', 'office', 'Заявки'],
  ['office.trials', 'Пробные', 'office', 'Пробные уроки'],
  ['office.contacts', 'Контакты', 'office', 'Ученики/родители'],
  ['office.groups', 'Группы', 'office', 'Группы'],
  ['office.payments', 'Оплаты', 'office', 'Платежи и CSV'],
  ['office.schedule', 'Расписание', 'office', 'Занятия'],
  ['office.attendance', 'Посещаемость', 'office', 'Отметки'],
  ['office.homework', 'ДЗ', 'office', 'Домашние задания'],
  ['office.gradebook', 'Журнал', 'office', 'Журнал оценок'],
  ['office.materials', 'Материалы', 'office', 'Материалы курсов'],
  ['office.documents', 'Документы офиса', 'office', 'Договоры и файлы'],
  ['office.announcements', 'Объявления', 'office', 'Рассылки'],
  ['office.reports', 'Отчёты', 'office', 'Аналитика офиса'],
  ['content.builder', 'Конструктор курсов', 'content', 'Редактор уроков/блоков'],
  ['content.teach', 'Контент', 'content', 'Кабинет преподавателя'],
  ['diary.access', 'Дневник', 'diary', 'Просмотр дневника'],
  ['diary.manage', 'Дневник: правки', 'diary', 'Оценки и формулы'],
  ['messages.access', 'Сообщения', 'comms', 'Переписка'],
  ['portfolio.access', 'Портфолио', 'learn', 'Проекты'],
  ['documents.access', 'Документы', 'docs', 'Личные/школьные файлы'],
  ['search.access', 'Поиск', 'office', 'Глобальный поиск'],
  ['admin.users', 'Пользователи', 'admin', 'Создание и роли людей'],
  ['admin.roles', 'Роли и права', 'admin', 'Настройка RBAC'],
  ['marketing.landings', 'Лендинги', 'marketing', 'Конструктор лендингов и акций'],
  ['marketing.analytics', 'Маркетинг-аналитика', 'marketing', 'Воронка и события лендингов'],
  ['parent.portal', 'Кабинет родителя', 'portal', 'Доступ родителя'],
  ['student.learn', 'Обучение', 'portal', 'Кабинет ученика'],
];

/** Roles that can sign in and be assigned. Other rows stay in the database. */
const LIVE_ROLES = ['admin', 'teacher', 'methodist', 'student', 'parent'];

function isLiveRole(code) {
  return LIVE_ROLES.includes(code);
}

const ROLE_DEFS = [
  ['admin', 'Администратор', 'Полный контроль платформы', 1],
  ['teacher', 'Преподаватель', 'Обучение, офис, дневник', 1],
  ['methodist', 'Методист', 'Курсы, уроки, проверочные и материалы', 1],
  ['accountant', 'Бухгалтер', 'Оплаты, отчёты, контакты', 1],
  ['hr', 'HR', 'Люди, контакты, группы', 1],
  ['analyst', 'Аналитик', 'Отчёты, журнал, поиск, экспорт', 1],
  ['marketer', 'Рекламщик', 'Лендинги, CRM, акции, аналитика', 1],
  ['student', 'Ученик', 'Обучение и дневник', 1],
  ['parent', 'Родитель', 'Кабинет ребёнка', 1],
];

/** Default permission sets per role (admin gets *) */
const ROLE_PERMS = {
  admin: ['*'],
  teacher: [
    'office.access', 'office.dashboard', 'office.leads', 'office.trials', 'office.contacts',
    'office.groups', 'office.payments', 'office.schedule', 'office.attendance', 'office.homework',
    'office.gradebook', 'office.materials', 'office.documents', 'office.announcements', 'office.reports',
    'content.builder', 'content.teach', 'diary.access', 'diary.manage', 'messages.access',
    'portfolio.access', 'documents.access', 'search.access',
    'marketing.landings', 'marketing.analytics',
  ],
  methodist: ['content.builder', 'content.teach'],
  accountant: [
    'office.access', 'office.dashboard', 'office.contacts', 'office.payments', 'office.reports',
    'documents.access', 'office.documents', 'search.access', 'messages.access',
  ],
  hr: [
    'office.access', 'office.dashboard', 'office.contacts', 'office.groups', 'admin.users',
    'documents.access', 'messages.access', 'search.access',
  ],
  analyst: [
    'office.access', 'office.dashboard', 'office.reports', 'office.gradebook', 'office.attendance',
    'diary.access', 'search.access', 'messages.access', 'marketing.analytics',
  ],
  marketer: [
    'office.access', 'office.dashboard', 'office.leads', 'office.trials', 'office.announcements',
    'messages.access', 'search.access', 'documents.access',
    'marketing.landings', 'marketing.analytics',
  ],
  student: [
    'student.learn', 'diary.access', 'messages.access', 'portfolio.access',
  ],
  parent: [
    'parent.portal', 'diary.access', 'messages.access', 'portfolio.access', 'documents.access',
  ],
};

function ensureRbacTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_system INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS permissions (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      module TEXT NOT NULL DEFAULT 'general',
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_code TEXT NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
      permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
      PRIMARY KEY (role_code, permission_code)
    );
  `);
}

function seedRbacDefaults() {
  ensureRbacTables();
  const insPerm = db.prepare(
    `INSERT OR IGNORE INTO permissions (code, name, module, description) VALUES (?, ?, ?, ?)`
  );
  for (const p of PERMISSIONS) insPerm.run(...p);

  const insRole = db.prepare(
    `INSERT OR IGNORE INTO roles (code, name, description, is_system, sort_order)
     VALUES (?, ?, ?, ?, ?)`
  );
  ROLE_DEFS.forEach((r, i) => insRole.run(r[0], r[1], r[2], r[3], i));

  const count = db.prepare('SELECT COUNT(*) as c FROM role_permissions').get().c;
  if (count === 0) {
    const ins = db.prepare(
      `INSERT OR IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)`
    );
    for (const [role, perms] of Object.entries(ROLE_PERMS)) {
      for (const p of perms) ins.run(role, p);
    }
  }
}

function getRole(code) {
  return db.prepare('SELECT * FROM roles WHERE code = ?').get(code);
}

function listRoles() {
  return db
    .prepare('SELECT * FROM roles WHERE active = 1 ORDER BY sort_order, name')
    .all();
}

function listAllRoles() {
  return db.prepare('SELECT * FROM roles ORDER BY sort_order, name').all();
}

function listPermissions() {
  return db.prepare('SELECT * FROM permissions ORDER BY module, name').all();
}

function permissionsForRole(roleCode) {
  if (!roleCode) return [];
  const rows = db
    .prepare(
      `SELECT permission_code FROM role_permissions WHERE role_code = ?`
    )
    .all(roleCode)
    .map((r) => r.permission_code);
  return rows;
}

function hasPermission(roleCode, ...needed) {
  if (!roleCode) return false;
  if (roleCode === 'admin') return true;
  const perms = permissionsForRole(roleCode);
  if (perms.includes('*')) return true;
  return needed.some((p) => perms.includes(p));
}

function setRolePermissions(roleCode, permissionCodes) {
  db.prepare('DELETE FROM role_permissions WHERE role_code = ?').run(roleCode);
  const ins = db.prepare(
    `INSERT INTO role_permissions (role_code, permission_code) VALUES (?, ?)`
  );
  for (const p of permissionCodes) ins.run(roleCode, p);
}

function resetDefaultRolePermissions() {
  db.prepare('DELETE FROM role_permissions').run();
  const ins = db.prepare(
    `INSERT OR IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)`
  );
  for (const [role, perms] of Object.entries(ROLE_PERMS)) {
    for (const p of perms) ins.run(role, p);
  }
}

function migrateUsersRoleConstraint() {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`).get();
  if (!row?.sql) return;
  // Drop CHECK if present (any version)
  if (!row.sql.includes('CHECK(role')) return;
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE users_rbac (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'student',
        grade INTEGER,
        avatar TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
    const hasActive = cols.includes('active');
    if (hasActive) {
      db.exec(`INSERT INTO users_rbac SELECT id, email, password, name, role, grade, avatar, active, created_at FROM users`);
    } else {
      db.exec(
        `INSERT INTO users_rbac (id, email, password, name, role, grade, avatar, active, created_at)
         SELECT id, email, password, name, role, grade, avatar, 1, created_at FROM users`
      );
    }
    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_rbac RENAME TO users');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    console.warn('users rbac migrate skipped:', e.message);
  }
  db.exec('PRAGMA foreign_keys = ON');

  // ensure active column exists even if no CHECK
  const cols2 = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  if (!cols2.includes('active')) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1`);
    } catch {
      // ignore
    }
  }
}

function freezeUnusedRoles() {
  db.prepare(
    `UPDATE roles SET active = 0 WHERE code NOT IN (${LIVE_ROLES.map(() => '?').join(',')})`
  ).run(...LIVE_ROLES);
  db.prepare(
    `UPDATE roles SET active = 1 WHERE code IN (${LIVE_ROLES.map(() => '?').join(',')})`
  ).run(...LIVE_ROLES);
}

function syncMethodistContentAccess() {
  setRolePermissions('methodist', ROLE_PERMS.methodist);
  db.prepare('UPDATE roles SET description = ? WHERE code = ?').run(
    'Курсы, уроки, проверочные и материалы',
    'methodist'
  );
}

function syncStudentCabinet() {
  db.prepare(
    `DELETE FROM role_permissions
     WHERE role_code = 'student' AND permission_code = 'documents.access'`
  ).run();
}

function initRbac() {
  ensureRbacTables();
  migrateUsersRoleConstraint();
  seedRbacDefaults();
  // Grant new marketing perms on existing DBs without full reseed
  const grant = db.prepare(
    `INSERT OR IGNORE INTO role_permissions (role_code, permission_code) VALUES (?, ?)`
  );
  for (const role of ['marketer', 'teacher', 'admin']) {
    grant.run(role, 'marketing.landings');
    grant.run(role, 'marketing.analytics');
  }
  grant.run('analyst', 'marketing.analytics');
  freezeUnusedRoles();
  syncMethodistContentAccess();
  syncStudentCabinet();
}

module.exports = {
  PERMISSIONS,
  ROLE_DEFS,
  ROLE_PERMS,
  LIVE_ROLES,
  isLiveRole,
  initRbac,
  seedRbacDefaults,
  getRole,
  listRoles,
  listAllRoles,
  listPermissions,
  permissionsForRole,
  hasPermission,
  setRolePermissions,
  resetDefaultRolePermissions,
};
