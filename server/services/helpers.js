const db = require('../db');

function paginate(query, { page = 1, limit = 50 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 50));
  const offset = (p - 1) * l;
  return { sql: `${query} LIMIT ${l} OFFSET ${offset}`, page: p, limit: l };
}

function refreshOverduePayments() {
  db.prepare(
    `UPDATE payments SET status = 'overdue'
     WHERE status = 'pending' AND date(due_date) < date('now')`
  ).run();
}

function money(n) {
  return Math.round(Number(n) * 100) / 100;
}

function findContactByEmail(type, email) {
  const value = (email || '').trim();
  if (!value) return null;
  return db
    .prepare(`SELECT * FROM contacts WHERE type = ? AND lower(email) = lower(?)`)
    .get(type, value);
}

/** Attach a new student/parent login to an existing contact with the same email, or create one. */
function linkPortalContact(user) {
  if (!user || (user.role !== 'student' && user.role !== 'parent')) return null;
  const existing = findContactByEmail(user.role, user.email);
  if (existing) {
    if (!existing.user_id) {
      db.prepare(`UPDATE contacts SET user_id = ? WHERE id = ?`).run(user.id, existing.id);
    }
    return db.prepare('SELECT * FROM contacts WHERE id = ?').get(existing.id);
  }
  const info = db
    .prepare(
      `INSERT INTO contacts (type, name, email, grade, user_id) VALUES (?, ?, ?, ?, ?)`
    )
    .run(user.role, user.name, user.email, user.grade ?? null, user.id);
  return db.prepare('SELECT * FROM contacts WHERE id = ?').get(info.lastInsertRowid);
}

/**
 * Reuse a contact of this type and email, otherwise insert one.
 * If a login of the same role already uses that email, store its user_id.
 */
function reuseOrCreateContact({ type, name, phone = null, email = null, grade = null, notes = '' }) {
  const existing = findContactByEmail(type, email);
  if (existing) {
    attachUserByEmail(existing.id, email, type);
    return existing.id;
  }
  const info = db
    .prepare(
      `INSERT INTO contacts (type, name, phone, email, grade, notes) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(type, name, phone, email, grade, notes);
  attachUserByEmail(info.lastInsertRowid, email, type);
  return info.lastInsertRowid;
}

function attachUserByEmail(contactId, email, role) {
  const value = (email || '').trim();
  if (!value) return;
  const user = db
    .prepare(`SELECT id, role FROM users WHERE lower(email) = lower(?)`)
    .get(value);
  if (!user || user.role !== role) return;
  db.prepare(`UPDATE contacts SET user_id = ? WHERE id = ? AND user_id IS NULL`).run(user.id, contactId);
}

module.exports = {
  paginate,
  refreshOverduePayments,
  money,
  findContactByEmail,
  linkPortalContact,
  reuseOrCreateContact,
};
