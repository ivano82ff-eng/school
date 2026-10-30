const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-wave6-${process.pid}-${Date.now()}.db`);
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
let studentToken;
let teacherToken;
let parentToken;

async function api(pathname, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json')
    ? await res.json().catch(() => ({}))
    : await res.text();
  return { status: res.status, data };
}

before(async () => {
  const app = createApp({ serveClient: false });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  studentToken = (
    await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'student@itscool.local', password: 'student123' },
    })
  ).data.token;
  teacherToken = (
    await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'teacher@itscool.local', password: 'teacher123' },
    })
  ).data.token;
  parentToken = (
    await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'parent@itscool.local', password: 'parent123' },
    })
  ).data.token;
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

describe('wave6 trials, portfolio, search, export', () => {
  it('lists seeded trial lessons', async () => {
    const { status, data } = await api('/api/trials', { token: teacherToken });
    assert.equal(status, 200);
    assert.ok(data.trials.length >= 1);
  });

  it('schedules a trial for a lead', async () => {
    const leads = await api('/api/leads?status=new', { token: teacherToken });
    const lead = leads.data.leads[0];
    assert.ok(lead);

    const created = await api('/api/trials', {
      method: 'POST',
      token: teacherToken,
      body: {
        lead_id: lead.id,
        title: 'Пробный Scratch',
        starts_at: '2026-08-20 16:00:00',
        ends_at: '2026-08-20 17:00:00',
        location: 'Zoom',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.trial.status, 'scheduled');

    const leadAfter = await api('/api/leads', { token: teacherToken });
    const updated = leadAfter.data.leads.find((l) => l.id === lead.id);
    assert.equal(updated.status, 'trial');
  });

  it('marks trial converted', async () => {
    const list = await api('/api/trials', { token: teacherToken });
    const trial = list.data.trials.find((t) => t.status === 'scheduled');
    assert.ok(trial);
    const patched = await api(`/api/trials/${trial.id}`, {
      method: 'PATCH',
      token: teacherToken,
      body: { status: 'converted', outcome_notes: 'Записались' },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.trial.status, 'converted');
  });

  it('student portfolio CRUD', async () => {
    const created = await api('/api/portfolio', {
      method: 'POST',
      token: studentToken,
      body: {
        title: 'Сайт-визитка',
        description: 'HTML/CSS лендинг',
        tech_stack: 'HTML, CSS',
        visibility: 'school',
        status: 'published',
      },
    });
    assert.equal(created.status, 201);

    const list = await api('/api/portfolio', { token: studentToken });
    assert.ok(list.data.projects.some((p) => p.title === 'Сайт-визитка'));

    const parentView = await api('/api/portfolio', { token: parentToken });
    assert.ok(parentView.data.projects.length >= 1);
  });

  it('global search finds contacts and courses', async () => {
    const { status, data } = await api('/api/search?q=Python', { token: teacherToken });
    assert.equal(status, 200);
    assert.ok(data.results.length >= 1);
    assert.ok(data.results.some((r) => r.type === 'course' || r.type === 'group'));
  });

  it('exports payments and diary csv', async () => {
    const payments = await api('/api/search/export/payments.csv', { token: teacherToken });
    assert.equal(payments.status, 200);
    assert.ok(String(payments.data).includes('Ученик') || String(payments.data).includes('ID'));

    const diary = await api('/api/search/export/diary.csv', { token: teacherToken });
    assert.equal(diary.status, 200);
    assert.ok(String(diary.data).includes('Критерий') || String(diary.data).includes('ID'));
  });
});
