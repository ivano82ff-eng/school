const db = require('../db');

function notifyUser(userId, { title, body = '', link = null, type = 'info' }) {
  if (!userId) return null;
  const info = db
    .prepare(
      `INSERT INTO notifications (user_id, title, body, link, type)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, title, body, link, type);
  return info.lastInsertRowid;
}

function notifyUsers(userIds, payload) {
  const ids = [...new Set(userIds.filter(Boolean))];
  for (const id of ids) notifyUser(id, payload);
}

function notifyRole(role, payload) {
  const users = db.prepare('SELECT id FROM users WHERE role = ?').all(role);
  notifyUsers(
    users.map((u) => u.id),
    payload
  );
}

function notifyContactUser(contactId, payload) {
  const c = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(contactId);
  if (c?.user_id) notifyUser(c.user_id, payload);
}

function notifyStudentParents(studentContactId, payload) {
  const parents = db
    .prepare(
      `SELECT c.user_id FROM contact_links l
       JOIN contacts c ON c.id = l.parent_id
       WHERE l.student_id = ? AND c.user_id IS NOT NULL`
    )
    .all(studentContactId);
  notifyUsers(
    parents.map((p) => p.user_id),
    payload
  );
}

module.exports = {
  notifyUser,
  notifyUsers,
  notifyRole,
  notifyContactUser,
  notifyStudentParents,
};
