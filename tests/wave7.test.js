const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-wave7-${process.pid}-${Date.now()}.db`);
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

async function api(pathname, { method = 'GET', token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (formData) {
    payload = formData;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${pathname}`, { method, headers, body: payload });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : await res.text();
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

describe('wave7 documents & course builder', () => {
  it('uploads a file and creates a document', async () => {
    const fd = new FormData();
    fd.append('file', new Blob(['hello wave7'], { type: 'text/plain' }), 'hw7.txt');
    const up = await api('/api/files/upload', {
      method: 'POST',
      token: teacherToken,
      formData: fd,
    });
    assert.equal(up.status, 201);
    assert.ok(up.data.file?.id);

    const doc = await api('/api/documents', {
      method: 'POST',
      token: teacherToken,
      body: {
        file_id: up.data.file.id,
        title: 'Тест договор',
        doc_type: 'contract',
      },
    });
    assert.equal(doc.status, 201);

    const list = await api('/api/documents?doc_type=contract', { token: teacherToken });
    assert.ok(list.data.documents.some((d) => d.title === 'Тест договор'));
  });

  it('loads builder tree and adds a quiz block', async () => {
    const courses = await api('/api/courses', { token: teacherToken });
    const course = courses.data.courses.find((c) => c.title.includes('Python')) || courses.data.courses[0];
    const tree = await api(`/api/builder/courses/${course.id}`, { token: teacherToken });
    assert.equal(tree.status, 200);
    assert.ok(Array.isArray(tree.data.block_types));
    assert.ok(tree.data.lessons.length >= 1);

    const lessonId = tree.data.lessons[0].id;
    const crit = tree.data.criteria.find((c) => c.code === 'quiz');
    const block = await api(`/api/builder/lessons/${lessonId}/blocks`, {
      method: 'POST',
      token: teacherToken,
      body: {
        type: 'quiz',
        title: 'Wave7 quiz',
        content: 'Автотест',
        criteria_id: crit?.id,
        config: {
          auto_grade: true,
          max_score: 5,
          questions: [
            { id: 1, question: '2+2?', options: ['3', '4'], correct_index: 1 },
          ],
        },
      },
    });
    assert.equal(block.status, 201);
    assert.equal(block.data.block.type, 'quiz');
  });

  it('plays lesson with blocks and submits block quiz', async () => {
    const courses = await api('/api/courses');
    const course = courses.data.courses.find((c) => c.title.includes('Python')) || courses.data.courses[0];
    await api(`/api/courses/${course.id}/enroll`, { method: 'POST', token: studentToken });
    const tree = await api(`/api/builder/courses/${course.id}`, { token: teacherToken });
    const lesson = tree.data.lessons[0];
    const play = await api(`/api/builder/lessons/${lesson.id}/play`, { token: studentToken });
    assert.equal(play.status, 200);
    assert.ok(play.data.blocks.length >= 1);

    const quizBlock =
      play.data.blocks.find((b) => b.type === 'quiz') ||
      (
        await api(`/api/builder/lessons/${lesson.id}/blocks`, {
          method: 'POST',
          token: teacherToken,
          body: {
            type: 'quiz',
            title: 'tmp',
            config: {
              questions: [{ id: 1, question: 'ok?', options: ['a', 'b'], correct_index: 0 }],
            },
          },
        })
      ).data.block;

    const attempt = await api(`/api/builder/blocks/${quizBlock.id}/quiz`, {
      method: 'POST',
      token: studentToken,
      body: { answers: { 1: quizBlock.config?.questions?.[0]?.correct_index ?? 0 } },
    });
    assert.equal(attempt.status, 200);
    assert.ok(attempt.data.total >= 1);
  });

  it('creates and resolves share link', async () => {
    const courses = await api('/api/courses', { token: teacherToken });
    const course = courses.data.courses[0];
    const created = await api('/api/shares', {
      method: 'POST',
      token: teacherToken,
      body: { target_type: 'course', target_id: course.id, label: 'share-test' },
    });
    assert.equal(created.status, 201);
    const resolved = await api(`/api/shares/${created.data.share.token}`);
    assert.equal(resolved.status, 200);
    assert.equal(resolved.data.payload.type, 'course');
  });
});
