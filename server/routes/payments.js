const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');
const { notifyStudentParents } = require('../services/notify');

const router = express.Router();
const staff = [authRequired, requirePermission('office.payments')];

function refreshOverdue() {
  db.prepare(
    `UPDATE payments SET status = 'overdue'
     WHERE status = 'pending' AND date(due_date) < date('now')`
  ).run();
}

function enrich(p) {
  const contact = db.prepare('SELECT id, name, type FROM contacts WHERE id = ?').get(p.contact_id);
  const group = p.group_id
    ? db.prepare('SELECT id, name FROM groups WHERE id = ?').get(p.group_id)
    : null;
  const author = p.created_by
    ? db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(p.created_by)
    : null;
  const editor = p.updated_by
    ? db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(p.updated_by)
    : null;
  return { ...p, contact, group, author, editor };
}

function tellParents(contactId, body) {
  notifyStudentParents(contactId, {
    title: 'Оплата',
    body,
    link: '/parent',
    type: 'payment',
  });
}

router.get('/', ...staff, (req, res) => {
  refreshOverdue();
  const { status, contact_id } = req.query;
  let sql = 'SELECT * FROM payments WHERE 1=1';
  const params = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (contact_id) {
    sql += ' AND contact_id = ?';
    params.push(Number(contact_id));
  }
  sql += ' ORDER BY due_date ASC';
  res.json({ payments: db.prepare(sql).all(...params).map(enrich) });
});

router.get('/summary', ...staff, (_req, res) => {
  refreshOverdue();
  const pending = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM payments WHERE status = 'pending'`).get();
  const overdue = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM payments WHERE status = 'overdue'`).get();
  const paid = db.prepare(`SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM payments WHERE status = 'paid'`).get();
  res.json({
    pending: { count: pending.c, sum: pending.s },
    overdue: { count: overdue.c, sum: overdue.s },
    paid: { count: paid.c, sum: paid.s },
  });
});

router.post('/', ...staff, (req, res) => {
  const {
    contact_id,
    group_id = null,
    amount,
    due_date,
    description = '',
    currency = 'RUB',
  } = req.body || {};

  if (!contact_id || amount == null || !due_date) {
    return res.status(400).json({ error: 'Нужны ученик, сумма и срок оплаты' });
  }

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(contact_id);
  if (!contact || contact.type !== 'student') {
    return res.status(400).json({ error: 'Платёж привязывается к ученику' });
  }

  let status = 'pending';
  if (due_date < new Date().toISOString().slice(0, 10)) status = 'overdue';

  const info = db
    .prepare(
      `INSERT INTO payments (contact_id, group_id, amount, currency, due_date, status, description, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      contact_id,
      group_id,
      Number(amount),
      currency,
      due_date,
      status,
      description,
      req.user.id,
      req.user.id
    );

  const payment = enrich(db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid));
  tellParents(contact.id, `${contact.name}: ${payment.amount} ${payment.currency}, ${payment.status}`);
  res.status(201).json({ payment });
});

router.post('/:id/mark-paid', ...staff, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  db.prepare(
    `UPDATE payments SET status = 'paid', paid_at = datetime('now'), updated_by = ? WHERE id = ?`
  ).run(req.user.id, payment.id);

  const saved = enrich(db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id));
  tellParents(payment.contact_id, `${saved.contact?.name || 'Ученик'}: оплачено ${saved.amount} ${saved.currency}`);
  res.json({ payment: saved });
});

router.patch('/:id', ...staff, (req, res) => {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!payment) return res.status(404).json({ error: 'Платёж не найден' });

  const {
    amount = payment.amount,
    due_date = payment.due_date,
    description = payment.description,
    status = payment.status,
    group_id = payment.group_id,
  } = req.body || {};

  db.prepare(
    `UPDATE payments SET amount=?, due_date=?, description=?, status=?, group_id=?, updated_by=? WHERE id=?`
  ).run(amount, due_date, description, status, group_id, req.user.id, payment.id);

  const saved = enrich(db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id));
  tellParents(payment.contact_id, `${saved.contact?.name || 'Ученик'}: ${saved.status}, ${saved.amount} ${saved.currency}`);
  res.json({ payment: saved });
});

module.exports = router;
