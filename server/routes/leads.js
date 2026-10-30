const express = require('express');
const db = require('../db');
const { authRequired, requirePermission } = require('../middleware/auth');

const router = express.Router();
const staff = [authRequired, requirePermission('office.leads')];

const STATUSES = ['new', 'contacted', 'trial', 'won', 'lost'];

router.post('/public', (req, res) => {
  const {
    name,
    phone,
    email,
    child_name,
    child_grade,
    interest = '',
    source = 'website',
    landing_page_id = null,
    landing_block_id = null,
    session_id = null,
    utm = null,
  } = req.body || {};

  if (!name || (!phone && !email)) {
    return res.status(400).json({ error: 'Укажите имя и телефон или email' });
  }

  let resolvedSource = source;
  if (landing_page_id) {
    const lp = db.prepare('SELECT slug FROM landing_pages WHERE id = ?').get(landing_page_id);
    if (lp) resolvedSource = `landing:${lp.slug}`;
  }

  const info = db
    .prepare(
      `INSERT INTO leads (
         name, phone, email, child_name, child_grade, interest, source, status,
         landing_page_id, landing_block_id, session_id, utm_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      phone || null,
      email || null,
      child_name || null,
      child_grade ? Number(child_grade) : null,
      interest,
      resolvedSource,
      landing_page_id ? Number(landing_page_id) : null,
      landing_block_id ? Number(landing_block_id) : null,
      session_id || null,
      JSON.stringify(utm || {})
    );

  const leadId = info.lastInsertRowid;

  if (landing_page_id) {
    try {
      db.prepare(
        `INSERT INTO landing_events (page_id, block_id, session_id, event_type, meta_json, lead_id)
         VALUES (?, ?, ?, 'form_submit', ?, ?)`
      ).run(
        Number(landing_page_id),
        landing_block_id ? Number(landing_block_id) : null,
        session_id || null,
        JSON.stringify({ interest }),
        leadId
      );
      if (session_id) {
        const points = Number(req.body?.gamifyPoints) || 50;
        const existing = db
          .prepare(
            `SELECT * FROM landing_game_states WHERE page_id = ? AND session_id = ?`
          )
          .get(Number(landing_page_id), session_id);
        if (existing) {
          db.prepare(
            `UPDATE landing_game_states
             SET score = score + ?, lead_id = ?, updated_at = datetime('now')
             WHERE id = ?`
          ).run(points, leadId, existing.id);
        } else {
          db.prepare(
            `INSERT INTO landing_game_states (page_id, session_id, score, state_json, lead_id)
             VALUES (?, ?, ?, '{}', ?)`
          ).run(Number(landing_page_id), session_id, points, leadId);
        }
      }
    } catch {
      // ignore analytics errors
    }
  }

  try {
    const { notifyRole } = require('../services/notify');
    notifyRole('teacher', {
      title: 'Новая заявка',
      body: `${name.trim()}${child_name ? ` · ${child_name}` : ''}`,
      link: '/office/leads',
      type: 'lead',
    });
    notifyRole('admin', {
      title: 'Новая заявка',
      body: `${name.trim()}${child_name ? ` · ${child_name}` : ''}`,
      link: '/office/leads',
      type: 'lead',
    });
    notifyRole('marketer', {
      title: 'Заявка с лендинга',
      body: `${name.trim()} · ${resolvedSource}`,
      link: '/office/landings',
      type: 'lead',
    });
  } catch {
    // ignore
  }

  res.status(201).json({
    ok: true,
    lead: db.prepare('SELECT id, status, created_at FROM leads WHERE id = ?').get(leadId),
  });
});

router.get('/', ...staff, (req, res) => {
  const { status, q } = req.query;
  let sql = 'SELECT * FROM leads WHERE 1=1';
  const params = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (q) {
    sql += ' AND (name LIKE ? OR child_name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY created_at DESC';
  res.json({ leads: db.prepare(sql).all(...params), statuses: STATUSES });
});

router.get('/pipeline', ...staff, (_req, res) => {
  const counts = STATUSES.map((status) => ({
    status,
    count: db.prepare('SELECT COUNT(*) as c FROM leads WHERE status = ?').get(status).c,
  }));
  res.json({ pipeline: counts });
});

router.patch('/:id', ...staff, (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Заявка не найдена' });

  const {
    status = lead.status,
    notes = lead.notes,
    assigned_to = lead.assigned_to,
    interest = lead.interest,
  } = req.body || {};

  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Неизвестный статус' });
  }

  db.prepare(
    `UPDATE leads SET status=?, notes=?, assigned_to=?, interest=?, updated_at=datetime('now')
     WHERE id=?`
  ).run(status, notes, assigned_to, interest, lead.id);

  res.json({ lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id) });
});

router.post('/:id/convert', ...staff, (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Заявка не найдена' });

  db.exec('BEGIN');
  try {
    let parentId = null;
    if (lead.name) {
      parentId = db
        .prepare(
          `INSERT INTO contacts (type, name, phone, email, notes)
           VALUES ('parent', ?, ?, ?, ?)`
        )
        .run(lead.name, lead.phone, lead.email, `Из заявки #${lead.id}`).lastInsertRowid;
    }

    let studentId = null;
    if (lead.child_name) {
      studentId = db
        .prepare(
          `INSERT INTO contacts (type, name, phone, email, grade, notes)
           VALUES ('student', ?, ?, ?, ?, ?)`
        )
        .run(
          lead.child_name,
          lead.phone,
          lead.email,
          lead.child_grade,
          `Из заявки #${lead.id}`
        ).lastInsertRowid;

      if (parentId && studentId) {
        db.prepare(
          'INSERT OR IGNORE INTO contact_links (parent_id, student_id) VALUES (?, ?)'
        ).run(parentId, studentId);
      }
    }

    db.prepare(
      `UPDATE leads SET status='won', contact_id=?, updated_at=datetime('now') WHERE id=?`
    ).run(studentId || parentId, lead.id);

    db.exec('COMMIT');
    res.json({
      ok: true,
      parentId,
      studentId,
      lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id),
    });
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});

module.exports = router;
