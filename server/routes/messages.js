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

function relatedContactIds(user) {
  if (user.role === 'student') {
    const c = db
      .prepare(`SELECT id FROM contacts WHERE user_id = ? AND type = 'student'`)
      .get(user.id);
    return c ? [c.id] : [];
  }
  if (user.role === 'parent') {
    const p = db
      .prepare(`SELECT id FROM contacts WHERE user_id = ? AND type = 'parent'`)
      .get(user.id);
    if (!p) return [];
    return db
      .prepare(`SELECT student_id FROM contact_links WHERE parent_id = ?`)
      .all(p.id)
      .map((r) => r.student_id);
  }
  return [];
}

function canReadThread(user, threadId) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (isParticipant(threadId, user.id)) return true;
  const ids = relatedContactIds(user);
  if (!ids.length) return false;
  const thread = db
    .prepare('SELECT related_contact_id FROM message_threads WHERE id = ?')
    .get(threadId);
  return !!(thread && ids.includes(thread.related_contact_id));
}

function listThreadIds(user) {
  if (user.role === 'admin') {
    return db
      .prepare(`SELECT id FROM message_threads ORDER BY updated_at DESC`)
      .all()
      .map((r) => r.id);
  }
  const ids = relatedContactIds(user);
  if (ids.length) {
    return db
      .prepare(
        `SELECT id FROM message_threads
         WHERE related_contact_id IN (${ids.map(() => '?').join(',')})
            OR id IN (SELECT thread_id FROM message_participants WHERE user_id = ?)
         ORDER BY updated_at DESC`
      )
      .all(...ids, user.id)
      .map((r) => r.id);
  }
  return db
    .prepare(
      `SELECT t.id FROM message_threads t
       JOIN message_participants mp ON mp.thread_id = t.id
       WHERE mp.user_id = ?
       ORDER BY t.updated_at DESC`
    )
    .all(user.id)
    .map((r) => r.id);
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
  const ids = listThreadIds(req.user);
  res.json({ threads: ids.map((id) => threadSummary(id, req.user.id)) });
});

router.get('/threads/:id', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!canReadThread(req.user, id)) {
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

router.get('/teachers', authRequired, requirePermission('messages.access'), (_req, res) => {
  const teachers = db
    .prepare(`SELECT id, name FROM users WHERE active = 1 AND role = 'teacher' ORDER BY name`)
    .all();
  res.json({ teachers });
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

  // A chosen teacher is a private thread. Otherwise students and parents write to the school.
  if (req.user.role === 'student' && req.body?.teacherId) {
    const teacher = db
      .prepare(`SELECT id FROM users WHERE id = ? AND active = 1 AND role = 'teacher'`)
      .get(Number(req.body.teacherId));
    if (!teacher) return res.status(400).json({ error: 'Выберите преподавателя' });
    participantIds = [teacher.id];
    const contact = db
      .prepare(`SELECT id FROM contacts WHERE user_id = ? AND type = 'student'`)
      .get(req.user.id);
    relatedContactId = contact?.id || null;
  } else if (req.user.role === 'student' || req.user.role === 'parent') {
    participantIds = db
      .prepare(
        `SELECT id FROM users WHERE active = 1 AND role IN ('teacher', 'admin')`
      )
      .all()
      .map((u) => u.id);
    if (req.user.role === 'student') {
      const contact = db
        .prepare(`SELECT id FROM contacts WHERE user_id = ? AND type = 'student'`)
        .get(req.user.id);
      relatedContactId = contact?.id || null;
    } else {
      const parent = db
        .prepare(`SELECT id FROM contacts WHERE user_id = ? AND type = 'parent'`)
        .get(req.user.id);
      const kids = parent ? relatedContactIds(req.user) : [];
      relatedContactId = kids[0] || parent?.id || null;
      for (const kidId of kids) {
        const child = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(kidId);
        if (child?.user_id) participantIds.push(child.user_id);
      }
    }
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

router.post('/course', authRequired, requirePermission('office.groups'), (req, res) => {
  const courseId = Number(req.body?.courseId);
  const subject = (req.body?.subject || '').trim();
  const body = (req.body?.body || '').trim();
  if (!courseId || !subject || !body) {
    return res.status(400).json({ error: 'Нужны курс, тема и текст' });
  }
  const course = db.prepare('SELECT id, title FROM courses WHERE id = ?').get(courseId);
  if (!course) return res.status(404).json({ error: 'Курс не найден' });

  const students = db
    .prepare(
      `SELECT DISTINCT u.id AS user_id, c.id AS contact_id, c.name
       FROM contacts c
       JOIN users u ON u.id = c.user_id AND u.active = 1
       WHERE c.type = 'student' AND u.id != ?
         AND (
           EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.course_id = ?)
           OR EXISTS (
             SELECT 1 FROM group_members gm
             JOIN groups g ON g.id = gm.group_id
             WHERE gm.contact_id = c.id AND gm.status = 'active' AND g.course_id = ?
           )
         )
       ORDER BY c.name`
    )
    .all(req.user.id, course.id, course.id);
  if (!students.length) {
    return res.status(400).json({ error: 'В курсе нет учеников с входом' });
  }

  const insertThread = db.prepare(
    `INSERT INTO message_threads (subject, created_by, related_contact_id, group_id)
     VALUES (?, ?, ?, NULL)`
  );
  const addPart = db.prepare(
    `INSERT INTO message_participants (thread_id, user_id, last_read_at) VALUES (?, ?, datetime('now'))`
  );
  const insertMessage = db.prepare(
    `INSERT INTO messages (thread_id, sender_id, body) VALUES (?, ?, ?)`
  );
  const sent = [];

  db.exec('BEGIN');
  try {
    for (const student of students) {
      const threadId = insertThread.run(subject, req.user.id, student.contact_id).lastInsertRowid;
      addPart.run(threadId, req.user.id);
      addPart.run(threadId, student.user_id);
      insertMessage.run(threadId, req.user.id, body);
      sent.push({ thread_id: threadId, user_id: student.user_id, name: student.name });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  for (const row of sent) {
    notifyUser(row.user_id, {
      title: 'Сообщение по курсу',
      body: subject,
      link: '/messages',
      type: 'message',
    });
  }

  res.status(201).json({ sent: sent.length, course: course.title });
});

router.post('/threads/:id/messages', authRequired, (req, res) => {
  const id = Number(req.params.id);
  if (!canReadThread(req.user, id)) {
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
