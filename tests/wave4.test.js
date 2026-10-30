const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-wave4-${process.pid}-${Date.now()}.db`);
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

describe('wave4 messages, gradebook, materials, certificates', () => {
  it('lists seeded message threads for parent and teacher', async () => {
    const parent = await api('/api/messages/threads', { token: parentToken });
    assert.equal(parent.status, 200);
    assert.ok(parent.data.threads.length >= 1);

    const teacher = await api('/api/messages/threads', { token: teacherToken });
    assert.equal(teacher.status, 200);
    assert.ok(teacher.data.threads.length >= 1);
  });

  it('allows student to start a thread with staff', async () => {
    const { status, data } = await api('/api/messages/threads', {
      method: 'POST',
      token: studentToken,
      body: {
        subject: 'Вопрос по уроку',
        body: 'Можно ли пересдать тест?',
      },
    });
    assert.equal(status, 201);
    assert.ok(data.thread?.id);

    const detail = await api(`/api/messages/threads/${data.thread.id}`, {
      token: studentToken,
    });
    assert.equal(detail.status, 200);
    assert.ok(detail.data.messages.length >= 1);
  });

  it('returns gradebook for a group', async () => {
    const groups = await api('/api/gradebook', { token: teacherToken });
    assert.equal(groups.status, 200);
    assert.ok(groups.data.groups.length >= 1);

    const gid = groups.data.groups[0].id;
    const book = await api(`/api/gradebook?group_id=${gid}`, { token: teacherToken });
    assert.equal(book.status, 200);
    assert.ok(book.data.students.length >= 1);
    assert.ok(book.data.students[0].stats);
  });

  it('lists course materials and creates one', async () => {
    const courses = await api('/api/courses');
    const course = courses.data.courses.find((c) => c.title.includes('Python')) || courses.data.courses[0];
    assert.ok(course);

    const list = await api(`/api/materials/course/${course.id}`);
    assert.equal(list.status, 200);
    assert.ok(list.data.materials.length >= 1);

    const created = await api('/api/materials', {
      method: 'POST',
      token: teacherToken,
      body: {
        course_id: course.id,
        title: 'Доп. материал Wave4',
        url: 'https://example.com/wave4',
        description: 'тест',
      },
    });
    assert.equal(created.status, 201);
  });

  it('opens student certificate', async () => {
    const dash = await api('/api/student/dashboard', { token: studentToken });
    assert.equal(dash.status, 200);
    assert.ok(dash.data.certificates.length >= 1);
    const certId = dash.data.certificates[0].id;

    const cert = await api(`/api/student/certificates/${certId}`, { token: studentToken });
    assert.equal(cert.status, 200);
    assert.ok(cert.data.certificate.student_name);
  });

  it('includes grades in parent dashboard', async () => {
    const { status, data } = await api('/api/parent/dashboard', { token: parentToken });
    assert.equal(status, 200);
    assert.ok(data.children.length >= 1);
    assert.ok(Array.isArray(data.children[0].grades));
  });
});
