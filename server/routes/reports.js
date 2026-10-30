const express = require('express');
const db = require('../db');
const { authRequired, requirePermission, userCan } = require('../middleware/auth');
const { refreshOverduePayments } = require('../services/helpers');

const router = express.Router();
const staff = [authRequired, requirePermission('office.reports')];

router.get('/overview', ...staff, (req, res) => {
  refreshOverduePayments();
  const seeMoney = userCan(req.user, 'office.payments', 'office.reports');
  const seeAttendance = userCan(req.user, 'office.attendance');
  const seeLeads = userCan(req.user, 'office.leads', 'marketing.analytics');
  const seeHomework = userCan(req.user, 'office.homework', 'office.gradebook');

  const unpaid = db
    .prepare(
      `SELECT p.*, c.name as student_name, g.name as group_name
       FROM payments p
       JOIN contacts c ON c.id = p.contact_id
       LEFT JOIN groups g ON g.id = p.group_id
       WHERE p.status IN ('pending', 'overdue')
       ORDER BY p.due_date ASC
       LIMIT 30`
    )
    .all();

  const lowAttendance = db
    .prepare(
      `SELECT c.id, c.name, c.grade,
              COUNT(a.id) as marked,
              SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
              SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent
       FROM contacts c
       JOIN attendance a ON a.contact_id = c.id
       WHERE c.type = 'student'
       GROUP BY c.id
       HAVING marked >= 1 AND (1.0 * present / marked) < 0.75
       ORDER BY absent DESC
       LIMIT 20`
    )
    .all();

  const openLeads = db
    .prepare(
      `SELECT COUNT(*) as c FROM leads WHERE status IN ('new', 'contacted', 'trial')`
    )
    .get().c;

  const homeworkPending = db
    .prepare(
      `SELECT COUNT(*) as c FROM homework_submissions WHERE status IN ('assigned', 'submitted')`
    )
    .get().c;

  const revenuePaid = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status = 'paid'`)
    .get().s;

  const revenueOpen = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status IN ('pending','overdue')`
    )
    .get().s;

  res.json({
    unpaid: seeMoney ? unpaid : [],
    lowAttendance: seeAttendance ? lowAttendance : null,
    openLeads: seeLeads ? openLeads : null,
    homeworkPending: seeHomework ? homeworkPending : null,
    revenuePaid: seeMoney ? revenuePaid : null,
    revenueOpen: seeMoney ? revenueOpen : null,
  });
});

module.exports = router;
