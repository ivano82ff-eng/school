const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('search.access')];

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => csvEscape(c.title)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(',')
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}

router.get('/', ...staff, (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.status(400).json({ error: 'Введите минимум 2 символа' });
  }
  const like = `%${q}%`;

  const contacts = db
    .prepare(
      `SELECT id, type, name, phone, email, grade FROM contacts
       WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
       ORDER BY name LIMIT 15`
    )
    .all(like, like, like)
    .map((c) => ({
      type: 'contact',
      id: c.id,
      title: c.name,
      subtitle: `${c.type}${c.grade ? ` · ${c.grade} кл.` : ''}`,
      link: '/office/contacts',
    }));

  const leads = db
    .prepare(
      `SELECT id, name, child_name, phone, email, status, interest FROM leads
       WHERE name LIKE ? OR child_name LIKE ? OR phone LIKE ? OR email LIKE ? OR interest LIKE ?
       ORDER BY created_at DESC LIMIT 15`
    )
    .all(like, like, like, like, like)
    .map((l) => ({
      type: 'lead',
      id: l.id,
      title: l.name,
      subtitle: `${l.child_name || ''} · ${l.status}`.trim(),
      link: '/office/leads',
    }));

  const groups = db
    .prepare(
      `SELECT g.id, g.name, c.title as course_title FROM groups g
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE g.name LIKE ? OR c.title LIKE ?
       ORDER BY g.name LIMIT 10`
    )
    .all(like, like)
    .map((g) => ({
      type: 'group',
      id: g.id,
      title: g.name,
      subtitle: g.course_title || 'группа',
      link: '/office/groups',
    }));

  const courses = db
    .prepare(
      `SELECT id, title, category, icon FROM courses
       WHERE published = 1 AND (title LIKE ? OR category LIKE ? OR description LIKE ?)
       ORDER BY title LIMIT 10`
    )
    .all(like, like, like)
    .map((c) => ({
      type: 'course',
      id: c.id,
      title: `${c.icon || ''} ${c.title}`.trim(),
      subtitle: c.category,
      link: `/courses/${c.id}`,
    }));

  const trials = db
    .prepare(
      `SELECT t.id, t.title, t.starts_at, t.status, l.child_name, l.name as parent_name
       FROM trial_lessons t JOIN leads l ON l.id = t.lead_id
       WHERE t.title LIKE ? OR l.name LIKE ? OR l.child_name LIKE ?
       ORDER BY t.starts_at DESC LIMIT 10`
    )
    .all(like, like, like)
    .map((t) => ({
      type: 'trial',
      id: t.id,
      title: t.title,
      subtitle: `${t.child_name || t.parent_name} · ${t.status} · ${t.starts_at}`,
      link: '/office/trials',
    }));

  res.json({
    q,
    results: [...contacts, ...leads, ...groups, ...courses, ...trials],
  });
});

router.get('/export/payments.csv', ...staff, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.name as contact_name, g.name as group_name
       FROM payments p
       JOIN contacts c ON c.id = p.contact_id
       LEFT JOIN groups g ON g.id = p.group_id
       ORDER BY p.due_date DESC`
    )
    .all();

  const csv = toCsv(rows, [
    { title: 'ID', key: 'id' },
    { title: 'Ученик/контакт', key: 'contact_name' },
    { title: 'Группа', key: 'group_name' },
    { title: 'Сумма', key: 'amount' },
    { title: 'Валюта', key: 'currency' },
    { title: 'Срок', key: 'due_date' },
    { title: 'Оплачено', key: 'paid_at' },
    { title: 'Статус', key: 'status' },
    { title: 'Описание', key: 'description' },
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
  res.send(csv);
});

router.get('/export/diary.csv', ...staff, (req, res) => {
  const groupId = req.query.group_id ? Number(req.query.group_id) : null;
  let sql = `
    SELECT e.*, c.name as student_name, g.name as group_name, crit.name as criteria_name
    FROM diary_entries e
    JOIN contacts c ON c.id = e.contact_id
    JOIN groups g ON g.id = e.group_id
    JOIN diary_criteria crit ON crit.id = e.criteria_id
    WHERE 1=1`;
  const params = [];
  if (groupId) {
    sql += ' AND e.group_id = ?';
    params.push(groupId);
  }
  sql += ' ORDER BY e.graded_at DESC';
  const rows = db.prepare(sql).all(...params);

  const csv = toCsv(rows, [
    { title: 'ID', key: 'id' },
    { title: 'Ученик', key: 'student_name' },
    { title: 'Группа', key: 'group_name' },
    { title: 'Период', key: 'period_key' },
    { title: 'Критерий', key: 'criteria_name' },
    { title: 'Балл', key: 'score' },
    { title: 'Макс', key: 'max_score' },
    { title: 'Заголовок', key: 'title' },
    { title: 'За что', key: 'detail' },
    { title: 'Комментарий', key: 'comment' },
    { title: 'Дата', key: 'graded_at' },
  ]);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="diary.csv"');
  res.send(csv);
});

module.exports = router;
