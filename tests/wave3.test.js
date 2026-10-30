const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-wave3-${process.pid}-${Date.now()}.db`);
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

describe('wave3 student hub & notifications', () => {
  it('loads student dashboard with homework', async () => {
    const { status, data } = await api('/api/student/dashboard', {
      token: studentToken,
    });
    assert.equal(status, 200);
    assert.ok(Array.isArray(data.homework));
    assert.ok(data.homework.length >= 1);
    assert.ok(Array.isArray(data.announcements));
  });

  it('submits homework and notifies teacher', async () => {
    const dash = await api('/api/student/dashboard', { token: studentToken });
    const hw = dash.data.homework.find((h) => h.status === 'assigned');
    assert.ok(hw);

    const submitted = await api(`/api/student/homework/${hw.submission_id}/submit`, {
      method: 'POST',
      token: studentToken,
      body: { answer: 'name = "Max"\nprint(name)' },
    });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.data.submission.status, 'submitted');

    const notifs = await api('/api/notifications', { token: teacherToken });
    assert.ok(notifs.data.notifications.some((n) => n.title.includes('Сдано')));
  });

  it('creates announcement and fans out notifications', async () => {
    const created = await api('/api/announcements', {
      method: 'POST',
      token: teacherToken,
      body: {
        title: 'Тестовое объявление',
        body: 'Проверка рассылки',
        audience: 'students',
      },
    });
    assert.equal(created.status, 201);

    const notifs = await api('/api/notifications', { token: studentToken });
    assert.ok(notifs.data.notifications.some((n) => n.title.includes('Тестовое')));
  });

  it('marks notifications read', async () => {
    const before = await api('/api/notifications', { token: studentToken });
    assert.ok(before.data.unread >= 0);
    const readAll = await api('/api/notifications/read-all', {
      method: 'POST',
      token: studentToken,
    });
    assert.equal(readAll.status, 200);
    const after = await api('/api/notifications', { token: studentToken });
    assert.equal(after.data.unread, 0);
  });
});
