const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authRequired, requirePermission('office.dashboard'), (_req, res) => {
  db.prepare(
    `UPDATE payments SET status = 'overdue'
     WHERE status = 'pending' AND date(due_date) < date('now')`
  ).run();

  const students = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE type = 'student'`).get().c;
  const parents = db.prepare(`SELECT COUNT(*) as c FROM contacts WHERE type = 'parent'`).get().c;
  const groups = db.prepare(`SELECT COUNT(*) as c FROM groups WHERE status = 'active'`).get().c;
  const overdue = db.prepare(`SELECT COUNT(*) as c FROM payments WHERE status = 'overdue'`).get().c;
  const pendingSum = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status IN ('pending','overdue')`
    )
    .get().s;
  const leadsOpen = db
    .prepare(`SELECT COUNT(*) as c FROM leads WHERE status IN ('new','contacted','trial')`)
    .get().c;

  const upcoming = db
    .prepare(
      `SELECT s.*, g.name as group_name
       FROM schedule_sessions s
       JOIN groups g ON g.id = s.group_id
       WHERE s.starts_at >= datetime('now') AND s.status = 'planned'
       ORDER BY s.starts_at ASC
       LIMIT 5`
    )
    .all();

  const recentPayments = db
    .prepare(
      `SELECT p.*, c.name as student_name
       FROM payments p
       JOIN contacts c ON c.id = p.contact_id
       ORDER BY p.created_at DESC
       LIMIT 5`
    )
    .all();

  const recentLeads = db
    .prepare(`SELECT * FROM leads ORDER BY created_at DESC LIMIT 5`)
    .all();

  res.json({
    stats: { students, parents, groups, overdue, pendingSum, leadsOpen },
    upcoming,
    recentPayments,
    recentLeads,
  });
});

module.exports = router;
