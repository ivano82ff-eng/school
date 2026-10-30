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

module.exports = { paginate, refreshOverduePayments, money };
