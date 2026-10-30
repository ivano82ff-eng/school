const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-test-${process.pid}-${Date.now()}.db`);
process.env.ITSCOOL_DB_PATH = dbFile;

// Fresh modules against the temp DB
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

describe('health', () => {
  it('returns ok', async () => {
    const { status, data } = await api('/api/health');
    assert.equal(status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.name, 'IT-Scool');
  });
});

describe('auth', () => {
  it('logs in demo student', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'student@itscool.local', password: 'student123' },
    });
    assert.equal(status, 200);
    assert.ok(data.token);
    assert.equal(data.user.role, 'student');
  });

  it('rejects bad password', async () => {
    const { status, data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'student@itscool.local', password: 'wrong' },
    });
    assert.equal(status, 401);
    assert.ok(data.error);
  });

  it('registers a new student', async () => {
    const email = `kid-${Date.now()}@test.local`;
    const { status, data } = await api('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Тест Ученик',
        email,
        password: 'pass1234',
        grade: 6,
        role: 'student',
      },
    });
    assert.equal(status, 201);
    assert.equal(data.user.grade, 6);
  });
});

describe('courses & learning', () => {
  let studentToken;

  before(async () => {
    const { data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'student@itscool.local', password: 'student123' },
    });
    studentToken = data.token;
  });

  it('lists published courses', async () => {
    const { status, data } = await api('/api/courses');
    assert.equal(status, 200);
    assert.ok(data.courses.length >= 8);
  });

  it('filters by grade', async () => {
    const { data } = await api('/api/courses?grade=7');
    assert.ok(data.courses.every((c) => c.grade_min <= 7 && c.grade_max >= 7));
  });

  it('enrolls and opens a lesson', async () => {
    const list = await api('/api/courses');
    const courseId = list.data.courses[0].id;
    const enroll = await api(`/api/courses/${courseId}/enroll`, {
      method: 'POST',
      token: studentToken,
    });
    assert.equal(enroll.status, 200);

    const detail = await api(`/api/courses/${courseId}`, { token: studentToken });
    assert.equal(detail.status, 200);
    assert.ok(detail.data.course.enrolled);
    assert.ok(detail.data.lessons.length > 0);

    const lessonId = detail.data.lessons[0].id;
    const lesson = await api(`/api/lessons/${lessonId}`, { token: studentToken });
    assert.equal(lesson.status, 200);
    assert.ok(lesson.data.lesson.title);

    const done = await api(`/api/lessons/${lessonId}/complete`, {
      method: 'POST',
      token: studentToken,
    });
    assert.equal(done.status, 200);
  });
});

describe('office MVP', () => {
  let teacherToken;

  before(async () => {
    const { data } = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'teacher@itscool.local', password: 'teacher123' },
    });
    teacherToken = data.token;
  });

  it('forbids students from office dashboard', async () => {
    const student = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'student@itscool.local', password: 'student123' },
    });
    const { status } = await api('/api/office/dashboard', {
      token: student.data.token,
    });
    assert.equal(status, 403);
  });

  it('loads office dashboard stats', async () => {
    const { status, data } = await api('/api/office/dashboard', {
      token: teacherToken,
    });
    assert.equal(status, 200);
    assert.ok(data.stats.students >= 1);
    assert.ok(data.stats.groups >= 1);
  });

  it('creates contact, group member, payment and session', async () => {
    const contact = await api('/api/contacts', {
      method: 'POST',
      token: teacherToken,
      body: {
        type: 'student',
        name: 'Тест Контакт',
        grade: 8,
        phone: '+7 900 000-00-00',
      },
    });
    assert.equal(contact.status, 201);
    const contactId = contact.data.contact.id;

    const groups = await api('/api/groups', { token: teacherToken });
    assert.ok(groups.data.groups.length >= 1);
    const groupId = groups.data.groups[0].id;

    const member = await api(`/api/groups/${groupId}/members`, {
      method: 'POST',
      token: teacherToken,
      body: { contact_id: contactId },
    });
    assert.equal(member.status, 200);

    const due = new Date();
    due.setDate(due.getDate() + 7);
    const payment = await api('/api/payments', {
      method: 'POST',
      token: teacherToken,
      body: {
        contact_id: contactId,
        group_id: groupId,
        amount: 1000,
        due_date: due.toISOString().slice(0, 10),
        description: 'Тестовый платёж',
      },
    });
    assert.equal(payment.status, 201);
    assert.equal(payment.data.payment.status, 'pending');

    const paid = await api(`/api/payments/${payment.data.payment.id}/mark-paid`, {
      method: 'POST',
      token: teacherToken,
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.data.payment.status, 'paid');

    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(15, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 30, 0, 0);

    const toLocal = (d) => d.toISOString().slice(0, 16).replace('T', ' ');
    const session = await api('/api/schedule', {
      method: 'POST',
      token: teacherToken,
      body: {
        group_id: groupId,
        title: 'Тестовое занятие',
        starts_at: toLocal(start),
        ends_at: toLocal(end),
        location: 'Zoom',
      },
    });
    assert.equal(session.status, 201);
    assert.equal(session.data.session.status, 'planned');
  });

  it('lists payments summary', async () => {
    const { status, data } = await api('/api/payments/summary', {
      token: teacherToken,
    });
    assert.equal(status, 200);
    assert.ok('pending' in data);
    assert.ok('paid' in data);
  });
});
