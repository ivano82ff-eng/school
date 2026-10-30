const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-wave2-${process.pid}-${Date.now()}.db`);
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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

before(async () => {
  const app = createApp({ serveClient: false });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

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

describe('wave2 CRM & ops', () => {
  it('accepts public lead application', async () => {
    const { status, data } = await api('/api/leads/public', {
      method: 'POST',
      body: {
        name: 'Тест Родитель',
        phone: '+79990001122',
        child_name: 'Тест Ребёнок',
        child_grade: 5,
        interest: 'Scratch',
      },
    });
    assert.equal(status, 201);
    assert.equal(data.lead.status, 'new');
  });

  it('shows CRM pipeline and converts lead', async () => {
    const list = await api('/api/leads?status=new', { token: teacherToken });
    assert.equal(list.status, 200);
    assert.ok(list.data.leads.length >= 1);
    const leadId = list.data.leads[0].id;

    const converted = await api(`/api/leads/${leadId}/convert`, {
      method: 'POST',
      token: teacherToken,
    });
    assert.equal(converted.status, 200);
    assert.equal(converted.data.lead.status, 'won');
  });

  it('marks attendance for a session', async () => {
    const sessions = await api('/api/schedule', { token: teacherToken });
    const session = sessions.data.sessions.find((s) => s.status === 'planned');
    assert.ok(session);

    const roster = await api(`/api/attendance/session/${session.id}`, {
      token: teacherToken,
    });
    assert.equal(roster.status, 200);
    assert.ok(roster.data.roster.length >= 1);

    const marks = roster.data.roster.map((r) => ({
      contact_id: r.contact_id,
      status: 'present',
    }));

    const saved = await api(`/api/attendance/session/${session.id}`, {
      method: 'POST',
      token: teacherToken,
      body: { marks },
    });
    assert.equal(saved.status, 200);
  });

  it('creates homework for a group', async () => {
    const groups = await api('/api/groups', { token: teacherToken });
    const groupId = groups.data.groups[0].id;
    const created = await api('/api/homework', {
      method: 'POST',
      token: teacherToken,
      body: {
        group_id: groupId,
        title: 'Тестовое ДЗ',
        description: 'Сделай упражнение',
        due_date: '2099-01-01',
      },
    });
    assert.equal(created.status, 201);
    assert.ok(created.data.homework.stats.total >= 1);
  });

  it('loads reports overview', async () => {
    const { status, data } = await api('/api/reports/overview', {
      token: teacherToken,
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.unpaid));
    assert.ok('revenuePaid' in data);
  });

  it('loads parent portal dashboard', async () => {
    const { status, data } = await api('/api/parent/dashboard', {
      token: parentToken,
    });
    assert.equal(status, 200);
    assert.ok(data.children.length >= 1);
    assert.equal(data.children[0].child.name, 'Максим Ученик');
  });
});
