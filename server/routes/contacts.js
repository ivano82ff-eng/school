const express = require('express');
const db = require('../db');
const { authRequired, requirePermission, userCan } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('office.contacts')];

function withParents(contact) {
  if (contact.type !== 'student') return { ...contact, parents: [] };
  const parents = db
    .prepare(
      `SELECT c.* FROM contacts c
       JOIN contact_links l ON l.parent_id = c.id
       WHERE l.student_id = ?`
    )
    .all(contact.id);
  return { ...contact, parents };
}

function withChildren(contact) {
  if (contact.type !== 'parent') return { ...contact, children: [] };
  const children = db
    .prepare(
      `SELECT c.* FROM contacts c
       JOIN contact_links l ON l.student_id = c.id
       WHERE l.parent_id = ?`
    )
    .all(contact.id);
  return { ...contact, children };
}

router.get('/', ...staff, (req, res) => {
  const { type, q } = req.query;
  let sql = 'SELECT * FROM contacts WHERE 1=1';
  const params = [];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY name';
  const contacts = db
    .prepare(sql)
    .all(...params)
    .map((c) => (c.type === 'student' ? withParents(c) : withChildren(c)));
  res.json({ contacts });
});

router.get('/:id', ...staff, (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Контакт не найден' });
  const detail = contact.type === 'student' ? withParents(contact) : withChildren(contact);
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.status, c.title as course_title
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       LEFT JOIN courses c ON c.id = g.course_id
       WHERE gm.contact_id = ? AND gm.status = 'active'`
    )
    .all(contact.id);
  const payments = userCan(req.user, 'office.payments', 'office.reports')
    ? db
        .prepare(
          `SELECT * FROM payments WHERE contact_id = ? ORDER BY due_date DESC LIMIT 20`
        )
        .all(contact.id)
    : [];
  res.json({ contact: detail, groups, payments });
});

router.post('/', ...staff, (req, res) => {
  const { type = 'student', name, phone, email, grade, notes, parent_ids = [] } = req.body || {};
  if (!name || !['student', 'parent', 'other'].includes(type)) {
    return res.status(400).json({ error: 'Укажите имя и тип контакта' });
  }
  const info = db
    .prepare(
      `INSERT INTO contacts (type, name, phone, email, grade, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(type, name.trim(), phone || null, email || null, grade || null, notes || null);

  if (type === 'student' && Array.isArray(parent_ids)) {
    const link = db.prepare(
      'INSERT OR IGNORE INTO contact_links (parent_id, student_id) VALUES (?, ?)'
    );
    for (const pid of parent_ids) link.run(Number(pid), info.lastInsertRowid);
  }

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ contact: withParents(contact) });
});

router.put('/:id', ...staff, (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Контакт не найден' });

  const {
    name = existing.name,
    phone = existing.phone,
    email = existing.email,
    grade = existing.grade,
    notes = existing.notes,
    parent_ids,
  } = req.body || {};

  db.prepare(
    `UPDATE contacts SET name=?, phone=?, email=?, grade=?, notes=? WHERE id=?`
  ).run(name, phone, email, grade, notes, existing.id);

  if (existing.type === 'student' && Array.isArray(parent_ids)) {
    db.prepare('DELETE FROM contact_links WHERE student_id = ?').run(existing.id);
    const link = db.prepare(
      'INSERT OR IGNORE INTO contact_links (parent_id, student_id) VALUES (?, ?)'
    );
    for (const pid of parent_ids) link.run(Number(pid), existing.id);
  }

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(existing.id);
  res.json({ contact: withParents(contact) });
});

router.delete('/:id', ...staff, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/link-parent', ...staff, (req, res) => {
  const student = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  const parent = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.body?.parent_id);
  if (!student || student.type !== 'student') {
    return res.status(400).json({ error: 'Нужен контакт-ученик' });
  }
  if (!parent || parent.type !== 'parent') {
    return res.status(400).json({ error: 'Нужен контакт-родитель' });
  }
  db.prepare(
    'INSERT OR IGNORE INTO contact_links (parent_id, student_id) VALUES (?, ?)'
  ).run(parent.id, student.id);
  res.json({ ok: true });
});

module.exports = router;
