const db = require('../db');
const { computePeriodGrade } = require('./diaryMath');

function studentContactByUser(userId) {
  return db
    .prepare(`SELECT * FROM contacts WHERE user_id = ? AND type = 'student'`)
    .get(userId);
}

function parentContactByUser(userId) {
  return db
    .prepare(`SELECT * FROM contacts WHERE user_id = ? AND type = 'parent'`)
    .get(userId);
}

function childrenContactIds(parentContactId) {
  return db
    .prepare(`SELECT student_id FROM contact_links WHERE parent_id = ?`)
    .all(parentContactId)
    .map((r) => r.student_id);
}

/** Can this user see diary of this student contact? */
function canViewStudent(user, contactId) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'teacher') return true;
  if (user.role === 'student') {
    const c = studentContactByUser(user.id);
    return c && c.id === Number(contactId);
  }
  if (user.role === 'parent') {
    const p = parentContactByUser(user.id);
    if (!p) return false;
    return childrenContactIds(p.id).includes(Number(contactId));
  }
  return false;
}

function canManageGroup(user, groupId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'teacher') {
    const g = db.prepare('SELECT teacher_id FROM groups WHERE id = ?').get(groupId);
    return !g?.teacher_id || g.teacher_id === user.id || true; // office teachers share groups
  }
  return false;
}

function ensureSystemCriteria() {
  const defaults = [
    ['homework', 'Домашнее задание', 'Выполнение ДЗ с пояснением темы', 5, 'higher_better'],
    ['oral', 'Ответ на уроке', 'Устный/письменный ответ с конкретикой темы', 5, 'higher_better'],
    ['late', 'Опоздание', 'Штрафные баллы за опоздания (меньше — лучше)', 5, 'lower_better'],
    ['extra', 'Доп. задание', 'Добровольные/углублённые задания', 5, 'higher_better'],
    ['quiz', 'Тест / проверочная', 'Мини-тест или контрольная', 5, 'higher_better'],
    ['project', 'Проект', 'Практический проект или портфолио', 5, 'higher_better'],
    ['activity', 'Активность', 'Участие, помощь одноклассникам, дисциплина+', 5, 'higher_better'],
  ];
  const insert = db.prepare(
    `INSERT OR IGNORE INTO diary_criteria
     (code, name, description, default_max_score, direction, is_system)
     VALUES (?, ?, ?, ?, ?, 1)`
  );
  for (const row of defaults) insert.run(...row);
}

function getSchemeForGroup(groupId) {
  return db.prepare('SELECT * FROM diary_schemes WHERE group_id = ?').get(groupId);
}

function getSchemeParts(schemeId) {
  return db
    .prepare(
      `SELECT p.*, c.code as criteria_code, c.name as criteria_name,
              c.default_max_score, c.direction, c.description as criteria_description
       FROM diary_scheme_parts p
       JOIN diary_criteria c ON c.id = p.criteria_id
       WHERE p.scheme_id = ?
       ORDER BY p.sort_order, p.id`
    )
    .all(schemeId);
}

function listEntries({ groupId, contactId, periodKey, criteriaId }) {
  const where = ['e.group_id = ?', 'e.contact_id = ?'];
  const params = [groupId, contactId];
  if (periodKey) {
    where.push('e.period_key = ?');
    params.push(periodKey);
  }
  if (criteriaId) {
    where.push('e.criteria_id = ?');
    params.push(criteriaId);
  }
  return db
    .prepare(
      `SELECT e.*, c.code as criteria_code, c.name as criteria_name, c.direction,
              c.color as criteria_color, u.name as teacher_name
       FROM diary_entries e
       JOIN diary_criteria c ON c.id = e.criteria_id
       LEFT JOIN users u ON u.id = e.created_by
       WHERE ${where.join(' AND ')}
       ORDER BY e.graded_at DESC, e.id DESC`
    )
    .all(...params);
}

function buildStudentDiary({ groupId, contactId, periodKey }) {
  const group = db
    .prepare(
      `SELECT g.*, co.title as course_title
       FROM groups g LEFT JOIN courses co ON co.id = g.course_id
       WHERE g.id = ?`
    )
    .get(groupId);
  if (!group) return null;

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contactId);
  if (!contact) return null;

  const scheme = getSchemeForGroup(groupId);
  const parts = scheme ? getSchemeParts(scheme.id) : [];
  const entries = listEntries({ groupId, contactId, periodKey: periodKey || undefined });

  const periodKeys = [
    ...new Set(
      db
        .prepare(
          `SELECT DISTINCT period_key FROM diary_entries
           WHERE group_id = ? AND contact_id = ? AND period_key != ''
           ORDER BY period_key DESC`
        )
        .all(groupId, contactId)
        .map((r) => r.period_key)
    ),
  ];

  const filtered = periodKey
    ? entries.filter((e) => e.period_key === periodKey)
    : entries;

  const breakdown =
    scheme && parts.length
      ? computePeriodGrade({ scheme, parts, entries: filtered })
      : {
          scale_max: 5,
          total: null,
          total_display: null,
          formula_text: 'Формула оценки для группы ещё не настроена',
          parts: [],
          entries_total: filtered.length,
        };

  return {
    group,
    contact,
    scheme,
    parts,
    period_key: periodKey || null,
    period_keys: periodKeys,
    entries: filtered,
    breakdown,
  };
}

function defaultPeriodKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

module.exports = {
  studentContactByUser,
  parentContactByUser,
  childrenContactIds,
  canViewStudent,
  canManageGroup,
  ensureSystemCriteria,
  getSchemeForGroup,
  getSchemeParts,
  listEntries,
  buildStudentDiary,
  defaultPeriodKey,
};
