const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { notifyUser, notifyStudentParents, notifyByPermission } = require('../services/notify');
const {
  canViewStudent,
  canManageGroup,
  canReadSchoolDiary,
  ensureSystemCriteria,
  getSchemeForGroup,
  getSchemeParts,
  buildStudentDiary,
  defaultPeriodKey,
  listAccessibleStudents,
} = require('../services/diary');

const router = express.Router();
const staff = [authRequired, requirePermission('diary.manage')];
const readers = [authRequired, requirePermission('diary.access')];

ensureSystemCriteria();

function groupsForStudent(contactId) {
  return db
    .prepare(
      `SELECT g.id, g.name, co.title as course_title
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       LEFT JOIN courses co ON co.id = g.course_id
       WHERE gm.contact_id = ? AND gm.status = 'active'
       ORDER BY g.name`
    )
    .all(contactId);
}

/** Overview: students + groups the current user can open */
router.get('/overview', ...readers, (req, res) => {
  ensureSystemCriteria();
  const students = listAccessibleStudents(req.user).map((s) => ({
    ...s,
    groups: groupsForStudent(s.id),
  }));

  const criteria = db
    .prepare('SELECT * FROM diary_criteria ORDER BY is_system DESC, name')
    .all();

  let pendingRaises = 0;
  if (canReadSchoolDiary(req.user)) {
    pendingRaises = db
      .prepare(`SELECT COUNT(*) as c FROM diary_raise_requests WHERE status = 'pending'`)
      .get().c;
  } else {
    pendingRaises = db
      .prepare(
        `SELECT COUNT(*) as c FROM diary_raise_requests
         WHERE requested_by = ? AND status = 'pending'`
      )
      .get(req.user.id).c;
  }

  res.json({
    role: req.user.role,
    students,
    criteria,
    pendingRaises,
    current_period: defaultPeriodKey(),
  });
});

router.get('/criteria', ...readers, (_req, res) => {
  ensureSystemCriteria();
  res.json({
    criteria: db.prepare('SELECT * FROM diary_criteria ORDER BY name').all(),
  });
});

router.post('/criteria', ...staff, (req, res) => {
  const code = (req.body?.code || '').trim().toLowerCase().replace(/\s+/g, '_');
  const name = (req.body?.name || '').trim();
  const description = (req.body?.description || '').trim();
  const default_max_score = Number(req.body?.default_max_score) || 5;
  const direction = req.body?.direction === 'lower_better' ? 'lower_better' : 'higher_better';
  if (!code || !name) return res.status(400).json({ error: 'Нужны code и name' });

  try {
    const id = db
      .prepare(
        `INSERT INTO diary_criteria (code, name, description, default_max_score, direction, is_system)
         VALUES (?, ?, ?, ?, ?, 0)`
      )
      .run(code, name, description, default_max_score, direction).lastInsertRowid;
    res.status(201).json({
      criteria: db.prepare('SELECT * FROM diary_criteria WHERE id = ?').get(id),
    });
  } catch {
    res.status(400).json({ error: 'Критерий с таким code уже есть' });
  }
});

/** Scheme for group */
router.get('/schemes/:groupId', ...readers, (req, res) => {
  const groupId = Number(req.params.groupId);
  const scheme = getSchemeForGroup(groupId);
  if (!scheme) return res.json({ scheme: null, parts: [] });
  res.json({ scheme, parts: getSchemeParts(scheme.id) });
});

router.put('/schemes/:groupId', ...staff, (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!canManageGroup(req.user, groupId)) {
    return res.status(403).json({ error: 'Нет доступа к группе' });
  }
  const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(groupId);
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });

  const name = (req.body?.name || 'Формула группы').trim();
  const scale_max = Number(req.body?.scale_max) || 5;
  const description = (req.body?.description || '').trim();
  const parts = Array.isArray(req.body?.parts) ? req.body.parts : [];

  const weightSum = parts.reduce((s, p) => s + (Number(p.weight) || 0), 0);
  if (parts.length && Math.abs(weightSum - 100) > 0.5) {
    return res.status(400).json({
      error: `Сумма весов должна быть 100% (сейчас ${weightSum})`,
    });
  }

  let scheme = getSchemeForGroup(groupId);
  if (!scheme) {
    const id = db
      .prepare(
        `INSERT INTO diary_schemes (group_id, name, scale_max, description, created_by)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(groupId, name, scale_max, description, req.user.id).lastInsertRowid;
    scheme = db.prepare('SELECT * FROM diary_schemes WHERE id = ?').get(id);
  } else {
    db.prepare(
      `UPDATE diary_schemes SET name = ?, scale_max = ?, description = ?, active = 1
       WHERE id = ?`
    ).run(name, scale_max, description, scheme.id);
    scheme = db.prepare('SELECT * FROM diary_schemes WHERE id = ?').get(scheme.id);
  }

  db.prepare('DELETE FROM diary_scheme_parts WHERE scheme_id = ?').run(scheme.id);
  const insert = db.prepare(
    `INSERT INTO diary_scheme_parts
     (scheme_id, criteria_id, weight, aggregation, label_override, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  parts.forEach((p, idx) => {
    const agg = ['avg', 'sum', 'max', 'min', 'latest'].includes(p.aggregation)
      ? p.aggregation
      : 'avg';
    insert.run(
      scheme.id,
      Number(p.criteria_id),
      Number(p.weight) || 0,
      agg,
      p.label_override || null,
      Number(p.sort_order) || idx
    );
  });

  res.json({ scheme, parts: getSchemeParts(scheme.id) });
});

/** Transparent diary for one student in a group */
router.get('/student/:contactId/group/:groupId', ...readers, (req, res) => {
  const contactId = Number(req.params.contactId);
  const groupId = Number(req.params.groupId);
  if (!canViewStudent(req.user, contactId) && !canManageGroup(req.user, groupId)) {
    return res.status(403).json({ error: 'Нет доступа к дневнику' });
  }

  const member = db
    .prepare(
      `SELECT 1 FROM group_members WHERE group_id = ? AND contact_id = ? AND status = 'active'`
    )
    .get(groupId, contactId);
  if (!member && req.user.role !== 'admin') {
    return res.status(404).json({ error: 'Ученик не в этой группе' });
  }

  const periodKey = req.query.period || null;
  const diary = buildStudentDiary({ groupId, contactId, periodKey });
  if (!diary) return res.status(404).json({ error: 'Не найдено' });

  const requests = db
    .prepare(
      `SELECT r.*, u.name as requester_name, e.title as entry_title
       FROM diary_raise_requests r
       JOIN users u ON u.id = r.requested_by
       LEFT JOIN diary_entries e ON e.id = r.entry_id
       WHERE r.group_id = ? AND r.contact_id = ?
       ORDER BY r.created_at DESC
       LIMIT 30`
    )
    .all(groupId, contactId);

  const feedback = db
    .prepare(
      `SELECT f.*, fu.name as from_name, fu.role as from_role, tu.name as to_name
       FROM diary_feedback f
       JOIN users fu ON fu.id = f.from_user_id
       LEFT JOIN users tu ON tu.id = f.to_user_id
       WHERE f.group_id = ? AND (f.contact_id = ? OR f.contact_id IS NULL)
       ORDER BY f.created_at DESC
       LIMIT 40`
    )
    .all(groupId, contactId);

  res.json({ ...diary, requests, feedback, can_manage: canManageGroup(req.user, groupId) });
});

/** Create grade entry (transparent) */
router.post('/entries', ...staff, (req, res) => {
  const group_id = Number(req.body?.group_id);
  const contact_id = Number(req.body?.contact_id);
  const criteria_id = Number(req.body?.criteria_id);
  const score = Number(req.body?.score);
  const max_score = Number(req.body?.max_score) || 5;
  const title = (req.body?.title || '').trim();
  const detail = (req.body?.detail || '').trim();
  const comment = (req.body?.comment || '').trim();
  const period_key = (req.body?.period_key || defaultPeriodKey()).trim();
  const session_id = req.body?.session_id ? Number(req.body.session_id) : null;
  const homework_id = req.body?.homework_id ? Number(req.body.homework_id) : null;

  if (!group_id || !contact_id || !criteria_id || !title || Number.isNaN(score)) {
    return res.status(400).json({
      error: 'Нужны group_id, contact_id, criteria_id, title и score',
    });
  }
  if (!detail) {
    return res.status(400).json({
      error: 'Укажите detail — за что конкретно выставлена оценка (прозрачность)',
    });
  }

  const id = db
    .prepare(
      `INSERT INTO diary_entries
       (group_id, contact_id, criteria_id, score, max_score, title, detail, comment,
        period_key, session_id, homework_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      group_id,
      contact_id,
      criteria_id,
      score,
      max_score,
      title,
      detail,
      comment,
      period_key,
      session_id,
      homework_id,
      req.user.id
    ).lastInsertRowid;

  const entry = db
    .prepare(
      `SELECT e.*, c.name as criteria_name, c.code as criteria_code
       FROM diary_entries e JOIN diary_criteria c ON c.id = e.criteria_id
       WHERE e.id = ?`
    )
    .get(id);

  const student = db.prepare('SELECT user_id, name FROM contacts WHERE id = ?').get(contact_id);
  if (student?.user_id) {
    notifyUser(student.user_id, {
      title: 'Новая оценка в дневнике',
      body: `${entry.criteria_name}: ${score}/${max_score} — ${title}`,
      link: '/diary',
      type: 'diary',
    });
  }
  notifyStudentParents(contact_id, {
    title: 'Оценка в дневнике',
    body: `${student?.name || 'Ученик'}: ${entry.criteria_name} ${score}/${max_score}`,
    link: '/diary',
    type: 'diary',
  });

  res.status(201).json({ entry });
});

router.patch('/entries/:id', ...staff, (req, res) => {
  const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Оценка не найдена' });

  const score = req.body.score != null ? Number(req.body.score) : entry.score;
  const max_score = req.body.max_score != null ? Number(req.body.max_score) : entry.max_score;
  const title = req.body.title != null ? String(req.body.title).trim() : entry.title;
  const detail = req.body.detail != null ? String(req.body.detail).trim() : entry.detail;
  const comment = req.body.comment != null ? String(req.body.comment).trim() : entry.comment;

  if (!detail) return res.status(400).json({ error: 'detail обязателен' });

  db.prepare(
    `UPDATE diary_entries
     SET score = ?, max_score = ?, title = ?, detail = ?, comment = ?, graded_at = datetime('now')
     WHERE id = ?`
  ).run(score, max_score, title, detail, comment, entry.id);

  res.json({
    entry: db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entry.id),
  });
});

router.delete('/entries/:id', ...staff, (req, res) => {
  const info = db.prepare('DELETE FROM diary_entries WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Не найдено' });
  res.json({ ok: true });
});

/** Raise request — student or parent */
router.post('/raise-requests', authRequired, (req, res) => {
  if (!['student', 'parent', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Запрос доступен ученику или родителю' });
  }

  const entry_id = req.body?.entry_id ? Number(req.body.entry_id) : null;
  let group_id = req.body?.group_id ? Number(req.body.group_id) : null;
  let contact_id = req.body?.contact_id ? Number(req.body.contact_id) : null;
  const requested_score = Number(req.body?.requested_score);
  const reason = (req.body?.reason || '').trim();

  if (!reason || Number.isNaN(requested_score)) {
    return res.status(400).json({ error: 'Нужны reason и requested_score' });
  }

  let current_score = null;
  if (entry_id) {
    const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entry_id);
    if (!entry) return res.status(404).json({ error: 'Оценка не найдена' });
    group_id = entry.group_id;
    contact_id = entry.contact_id;
    current_score = entry.score;
  }

  if (!group_id || !contact_id) {
    return res.status(400).json({ error: 'Нужны entry_id или pair group_id+contact_id' });
  }
  if (!canViewStudent(req.user, contact_id)) {
    return res.status(403).json({ error: 'Нет доступа к этому ученику' });
  }

  const id = db
    .prepare(
      `INSERT INTO diary_raise_requests
       (entry_id, group_id, contact_id, requested_by, current_score, requested_score, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      entry_id,
      group_id,
      contact_id,
      req.user.id,
      current_score,
      requested_score,
      reason
    ).lastInsertRowid;

  notifyByPermission('diary.manage', {
    title: 'Запрос на повышение оценки',
    body: reason.slice(0, 120),
    link: '/diary',
    type: 'diary',
  });

  res.status(201).json({
    request: db.prepare('SELECT * FROM diary_raise_requests WHERE id = ?').get(id),
  });
});

router.get('/raise-requests', ...readers, (req, res) => {
  let rows;
  if (canReadSchoolDiary(req.user)) {
    const status = req.query.status || null;
    rows = status
      ? db
          .prepare(
            `SELECT r.*, c.name as student_name, g.name as group_name, u.name as requester_name,
                    e.title as entry_title, e.detail as entry_detail
             FROM diary_raise_requests r
             JOIN contacts c ON c.id = r.contact_id
             JOIN groups g ON g.id = r.group_id
             JOIN users u ON u.id = r.requested_by
             LEFT JOIN diary_entries e ON e.id = r.entry_id
             WHERE r.status = ?
             ORDER BY r.created_at DESC`
          )
          .all(status)
      : db
          .prepare(
            `SELECT r.*, c.name as student_name, g.name as group_name, u.name as requester_name,
                    e.title as entry_title, e.detail as entry_detail
             FROM diary_raise_requests r
             JOIN contacts c ON c.id = r.contact_id
             JOIN groups g ON g.id = r.group_id
             JOIN users u ON u.id = r.requested_by
             LEFT JOIN diary_entries e ON e.id = r.entry_id
             ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC
             LIMIT 100`
          )
          .all();
  } else {
    rows = db
      .prepare(
        `SELECT r.*, c.name as student_name, g.name as group_name, e.title as entry_title
         FROM diary_raise_requests r
         JOIN contacts c ON c.id = r.contact_id
         JOIN groups g ON g.id = r.group_id
         LEFT JOIN diary_entries e ON e.id = r.entry_id
         WHERE r.requested_by = ? OR r.contact_id IN (
           SELECT id FROM contacts WHERE user_id = ?
           UNION
           SELECT student_id FROM contact_links cl
           JOIN contacts pc ON pc.id = cl.parent_id WHERE pc.user_id = ?
         )
         ORDER BY r.created_at DESC`
      )
      .all(req.user.id, req.user.id, req.user.id);
  }
  res.json({ requests: rows });
});

router.patch('/raise-requests/:id', ...staff, (req, res) => {
  const r = db.prepare('SELECT * FROM diary_raise_requests WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Запрос не найден' });

  const status = req.body?.status;
  if (!['approved', 'rejected', 'counter'].includes(status)) {
    return res.status(400).json({ error: 'status: approved | rejected | counter' });
  }
  const teacher_response = (req.body?.teacher_response || '').trim();
  const counter_score =
    req.body?.counter_score != null ? Number(req.body.counter_score) : null;

  if (status === 'approved' && r.entry_id) {
    const newScore = counter_score != null ? counter_score : r.requested_score;
    db.prepare(
      `UPDATE diary_entries SET score = ?, comment = comment || ?, graded_at = datetime('now')
       WHERE id = ?`
    ).run(
      newScore,
      `\n[Повышение по запросу #${r.id}] ${teacher_response || 'одобрено'}`,
      r.entry_id
    );
  }
  if (status === 'counter' && r.entry_id && counter_score != null) {
    db.prepare(
      `UPDATE diary_entries SET score = ?, comment = comment || ?, graded_at = datetime('now')
       WHERE id = ?`
    ).run(counter_score, `\n[Компромисс по запросу #${r.id}] ${teacher_response}`, r.entry_id);
  }

  db.prepare(
    `UPDATE diary_raise_requests
     SET status = ?, teacher_response = ?, counter_score = ?, reviewed_by = ?,
         reviewed_at = datetime('now')
     WHERE id = ?`
  ).run(status, teacher_response, counter_score, req.user.id, r.id);

  notifyUser(r.requested_by, {
    title: `Запрос на оценку: ${status}`,
    body: teacher_response || `Статус: ${status}`,
    link: '/diary',
    type: 'diary',
  });

  res.json({
    request: db.prepare('SELECT * FROM diary_raise_requests WHERE id = ?').get(r.id),
  });
});

/** Feedback between all roles in diary context */
router.post('/feedback', ...readers, (req, res) => {
  const group_id = Number(req.body?.group_id);
  const body = (req.body?.body || '').trim();
  const contact_id = req.body?.contact_id ? Number(req.body.contact_id) : null;
  const to_user_id = req.body?.to_user_id ? Number(req.body.to_user_id) : null;
  const related_entry_id = req.body?.related_entry_id
    ? Number(req.body.related_entry_id)
    : null;
  const related_request_id = req.body?.related_request_id
    ? Number(req.body.related_request_id)
    : null;

  if (!group_id || !body) {
    return res.status(400).json({ error: 'Нужны group_id и body' });
  }
  if (contact_id && !canViewStudent(req.user, contact_id) && !canManageGroup(req.user, group_id)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }

  const id = db
    .prepare(
      `INSERT INTO diary_feedback
       (group_id, contact_id, from_user_id, to_user_id, body, related_entry_id, related_request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      group_id,
      contact_id,
      req.user.id,
      to_user_id,
      body,
      related_entry_id,
      related_request_id
    ).lastInsertRowid;

  if (to_user_id) {
    notifyUser(to_user_id, {
      title: 'Обратная связь по дневнику',
      body: body.slice(0, 120),
      link: '/diary',
      type: 'diary',
    });
  } else {
    const g = db.prepare('SELECT teacher_id FROM groups WHERE id = ?').get(group_id);
    if (g?.teacher_id && g.teacher_id !== req.user.id) {
      notifyUser(g.teacher_id, {
        title: 'Обратная связь по дневнику',
        body: body.slice(0, 120),
        link: '/office/diary',
        type: 'diary',
      });
    }
    if (contact_id) {
      const st = db.prepare('SELECT user_id FROM contacts WHERE id = ?').get(contact_id);
      if (st?.user_id && st.user_id !== req.user.id) {
        notifyUser(st.user_id, {
          title: 'Комментарий в дневнике',
          body: body.slice(0, 120),
          link: '/diary',
          type: 'diary',
        });
      }
      notifyStudentParents(contact_id, {
        title: 'Комментарий в дневнике',
        body: body.slice(0, 120),
        link: '/diary',
        type: 'diary',
      });
    }
  }

  res.status(201).json({
    feedback: db.prepare('SELECT * FROM diary_feedback WHERE id = ?').get(id),
  });
});

module.exports = router;
