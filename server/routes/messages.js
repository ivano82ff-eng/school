const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { notifyUser } = require('../services/notify');

const router = express.Router();
const staff = [authRequired, requirePermission('messages.access')];

function isParticipant(threadId, userId) {
  return !!db
    .prepare('SELECT 1 FROM message_participants WHERE thread_id = ? AND user_id = ?')
    .get(threadId, userId);
}

function threadSummary(threadId, userId) {
  const thread = db.prepare('SELECT * FROM message_threads WHERE id = ?').get(threadId);
  if (!thread) return null;

  const participants = db
    .prepare(
      `SELECT u.id, u.name, u.role, u.email
       FROM message_participants mp
       JOIN users u ON u.id = mp.user_id
       WHERE mp.thread_id = ?`
    )
    .all(threadId);

  const last = db
    .prepare(
      `SELECT m.body, m.created_at, u.name as sender_name
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.thread_id = ? ORDER BY m.id DESC LIMIT 1`
    )
    .get(threadId);

  const me = db
    .prepare('SELECT last_read_at FROM message_participants WHERE thread_id = ? AND user_id = ?')
    .get(threadId, userId);

  const unread = db
    .prepare(
      `SELECT COUNT(*) as c FROM messages
       WHERE thread_id = ?
         AND sender_id != ?
         AND (? IS NULL OR created_at > ?)`
    )
    .get(threadId, userId, me?.last_read_at || null, me?.last_read_at || null).c;

  const contact = thread.related_contact_id
    ? db.prepare('SELECT id, name, type FROM contacts WHERE id = ?').get(thread.related_contact_id)
    : null;

  return { ...thread, participants, last, unread, contact };
}

router.get('/threads', authRequired, (req, res) => {
  const ids = db
    .prepare(
      `SELECT t.id FROM message_threads t
       JOIN message_participants mp ON mp.thread_id = t.id
       WHERE mp.user_id = ?
       ORDER BY t.updated_at DESC`
    )
    .all(req.user.id)
    .map((r) => r.id);

  res.json({ threads: ids.map((id) => threadSummary(id, req.user.id)) });
});

router.get('/threads/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!isParticipant(id, req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Нет доступа к переписке' });
  }

  const summary = threadSummary(id, req.user.id);
  if (!summary) return res.status(404).json({ error: 'Диалог не найден' });

  const messages = db
    .prepare(
      `SELECT m.*, u.name as sender_name, u.role as sender_role
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE m.thread_id = ?
       ORDER BY m.id ASC`
    )
    .all(id);

  db.prepare(
    `UPDATE message_participants SET last_read_at = datetime('now')
     WHERE thread_id = ? AND user_id = ?`
  ).run(id, req.user.id);

  res.json({ thread: summary, messages });
});

router.post('/threads', authRequired, (req, res) => {
  const subject = (req.body?.subject || '').trim();
  const body = (req.body?.body || '').trim();
  if (!subject || !body) {
    return res.status(400).json({ error: 'Нужны тема и первое сообщение' });
  }

  let participantIds = Array.isArray(req.body?.participantIds)
    ? req.body.participantIds.map(Number).filter(Boolean)
    : [];

  let relatedContactId = req.body?.contactId ? Number(req.body.contactId) : null;
  const groupId = req.body?.groupId ? Number(req.body.groupId) : null;

  // Students/parents can only open a thread with teaching/office staff
  if (req.user.role === 'student' || req.user.role === 'parent') {
    const staffUsers = db
      .prepare(
        `SELECT id FROM users
         WHERE active = 1 AND role NOT IN ('student', 'parent')`
      )
      .all()
      .map((u) => u.id);
    participantIds = staffUsers;
    const contact = db
      .prepare(`SELECT id FROM contacts WHERE user_id = ?`)
      .get(req.user.id);
    relatedContactId = contact?.id || null;
  } else if (relatedContactId) {
    const contact = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(relatedContactId);
    if (contact?.user_id) participantIds.push(contact.user_id);
  }

  participantIds = [...new Set([req.user.id, ...participantIds])];
  if (participantIds.length < 2) {
    return res.status(400).json({ error: 'Добавьте хотя бы одного участника' });
  }

  const threadId = db
    .prepare(
      `INSERT INTO message_threads (subject, created_by, related_contact_id, group_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(subject, req.user.id, relatedContactId, groupId).lastInsertRowid;

  const addPart = db.prepare(
    `INSERT INTO message_participants (thread_id, user_id, last_read_at)
     VALUES (?, ?, datetime('now'))`
  );
  for (const uid of participantIds) {
    addPart.run(threadId, uid);
  }

  db.prepare(`INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`).run(
    threadId,
    req.user.id,
    body
  );

  for (const uid of participantIds) {
    if (uid === req.user.id) continue;
    notifyUser(uid, {
      title: 'Новое сообщение',
      body: subject,
      link: '/messages',
      type: 'message',
    });
  }

  res.status(201).json({ thread: threadSummary(threadId, req.user.id) });
});

router.post('/threads/:id/messages', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!isParticipant(id, req.user.id) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Пустое сообщение' });

  const msgId = db
    .prepare(`INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`)
    .run(id, req.user.id, body).lastInsertRowid;

  db.prepare(`UPDATE message_threads SET updated_at = datetime('now') WHERE id = ?`).run(id);
  db.prepare(
    `UPDATE message_participants SET last_read_at = datetime('now')
     WHERE thread_id = ? AND user_id = ?`
  ).run(id, req.user.id);

  const others = db
    .prepare(`SELECT user_id FROM message_participants WHERE thread_id = ? AND user_id != ?`)
    .all(id, req.user.id);
  const thread = db.prepare('SELECT subject FROM message_threads WHERE id = ?').get(id);
  for (const o of others) {
    notifyUser(o.user_id, {
      title: 'Ответ в переписке',
      body: thread?.subject || 'Сообщение',
      link: '/messages',
      type: 'message',
    });
  }

  const message = db
    .prepare(
      `SELECT m.*, u.name as sender_name, u.role as sender_role
       FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
    )
    .get(msgId);

  res.status(201).json({ message });
});

/** Staff helper: list contacts with linked accounts for starting chats */
router.get('/directory', ...staff, (_req, res) => {
  const contacts = db
    .prepare(
      `SELECT c.id, c.name, c.type, c.grade, c.user_id, u.email
       FROM contacts c
       JOIN users u ON u.id = c.user_id
       WHERE c.user_id IS NOT NULL
       ORDER BY c.type, c.name`
    )
    .all();
  res.json({ contacts });
});

module.exports = router;
