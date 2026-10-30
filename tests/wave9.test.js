const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-w9-${process.pid}-${Date.now()}.db`);
process.env.ITSCOOL_DB_PATH = dbFile;

for (const key of Object.keys(require.cache)) {
  if (key.replace(/\\/g, '/').includes('/server/')) {
    delete require.cache[key];
  }
}

require('../server/seed');
const { createApp } = require('../server/app');

let server;
let baseUrl;

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email, password) {
  const { status, data } = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(status, 200, data.error || 'login');
  return data;
}

before(async () => {
  const app = createApp({ serveClient: false });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.unlinkSync(dbFile + suffix);
    } catch {
      // ignore
    }
  }
});

describe('wave9 marketing landings', () => {
  it('teacher lists landings and opens builder', async () => {
    const { token, user } = await login('teacher@itscool.local', 'teacher123');
    assert.ok(user.permissions.includes('marketing.landings'));
    const list = await api('/api/landings', { token });
    assert.equal(list.status, 200);
    assert.ok(list.data.pages.length >= 1);
    const id = list.data.pages[0].id;
    const page = await api(`/api/landings/${id}`, { token });
    assert.equal(page.status, 200);
    assert.ok(page.data.blocks.length >= 3);
  });

  it('public published landing tracks view', async () => {
    const pub = await api('/api/landings/public/python-leto?sid=test-sid');
    assert.equal(pub.status, 200);
    assert.equal(pub.data.page.slug, 'python-leto');
    assert.ok(pub.data.blocks.some((b) => b.type === 'cta_form'));
  });

  it('lead from landing goes to CRM with attribution', async () => {
    const pub = await api('/api/landings/public/python-leto');
    const pageId = pub.data.page.id;
    const form = pub.data.blocks.find((b) => b.type === 'cta_form');
    const lead = await api('/api/leads/public', {
      method: 'POST',
      body: {
        name: 'Марк Родитель',
        phone: '+79990001122',
        child_name: 'Кира',
        child_grade: 6,
        interest: 'Python лето',
        landing_page_id: pageId,
        landing_block_id: form.id,
        session_id: 'lead-sid',
        gamifyPoints: 50,
      },
    });
    assert.equal(lead.status, 201, lead.data.error);

    const { token } = await login('teacher@itscool.local', 'teacher123');
    const crm = await api('/api/leads?q=Марк', { token });
    assert.equal(crm.status, 200);
    const row = crm.data.leads.find((l) => l.name === 'Марк Родитель');
    assert.ok(row);
    assert.equal(row.landing_page_id, pageId);
    assert.match(row.source, /^landing:/);

    const analytics = await api(`/api/landings/${pageId}/analytics`, { token });
    assert.equal(analytics.status, 200);
    assert.ok(analytics.data.summary.leads >= 1);
  });

  it('survey and game endpoints work', async () => {
    const pub = await api('/api/landings/public/python-leto');
    const quiz = pub.data.blocks.find((b) => b.type === 'quiz_game');
    const survey = await api('/api/landings/public/python-leto/survey', {
      method: 'POST',
      body: {
        block_id: quiz.id,
        session_id: 'game-sid',
        answers: { q1: 'a', q2: 'a' },
      },
    });
    assert.equal(survey.status, 201);
    assert.equal(survey.data.score, 100);

    const game = await api('/api/landings/public/python-leto/game', {
      method: 'POST',
      body: { session_id: 'game-sid', delta: 10 },
    });
    assert.equal(game.status, 200);
    assert.ok(game.data.game.score >= 10);

    const board = await api('/api/landings/public/python-leto/leaderboard');
    assert.equal(board.status, 200);
    assert.ok(board.data.leaderboard.length >= 1);
  });

  it('student cannot manage landings', async () => {
    const { token } = await login('student@itscool.local', 'student123');
    const list = await api('/api/landings', { token });
    assert.equal(list.status, 403);
  });
});
