const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-outline-${process.pid}-${Date.now()}.db`);
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
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return res;
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

describe('course block builder', () => {
  it('lets methodist, teacher, and admin build a course others can see', async () => {
    const methodist = await login('methodist@itscool.local', 'methodist123');
    assert.equal(methodist.status, 200);
    assert.equal(methodist.data.user.flags.content, true);
    assert.equal(methodist.data.user.flags.office, false);
    const token = methodist.data.token;

    const payments = await api('/api/payments', { token });
    assert.equal(payments.status, 403);
    const office = await api('/api/office/dashboard', { token });
    assert.equal(office.status, 403);

    const title = `Блоки ${Date.now()}`;
    const created = await api('/api/outline/courses', {
      method: 'POST',
      token,
      body: {
        title,
        description: 'Курс из урока, проверочной и материала',
        category: 'Программирование',
        grade_min: 5,
        grade_max: 8,
      },
    });
    assert.equal(created.status, 201, created.data.error);
    const courseId = created.data.course.id;

    const lesson = await api(`/api/outline/courses/${courseId}/blocks`, {
      method: 'POST',
      token,
      body: { type: 'lesson', title: 'Переменные', content: 'Имя хранит значение' },
    });
    assert.equal(lesson.status, 201, lesson.data.error);
    const test = await api(`/api/outline/courses/${courseId}/blocks`, {
      method: 'POST',
      token,
      body: {
        type: 'test',
        title: 'Проверка переменных',
        questions: [
          {
            question: 'Что хранит переменная?',
            options: ['Значение', 'Класс'],
            correct_index: 0,
          },
        ],
      },
    });
    assert.equal(test.status, 201, test.data.error);
    const material = await api(`/api/outline/courses/${courseId}/blocks`, {
      method: 'POST',
      token,
      body: { type: 'material', title: 'Шпаргалка', url: 'https://example.com/python' },
    });
    assert.equal(material.status, 201, material.data.error);

    const blocks = material.data.blocks;
    assert.deepEqual(
      blocks.map((block) => block.type),
      ['lesson', 'test', 'material']
    );
    const order = [blocks[2], blocks[0], blocks[1]];
    const moved = await api(`/api/outline/courses/${courseId}/reorder`, {
      method: 'POST',
      token,
      body: { order: order.map((block) => ({ type: block.type, id: block.id })) },
    });
    assert.equal(moved.status, 200, moved.data.error);
    assert.deepEqual(
      moved.data.blocks.map((block) => block.type),
      ['material', 'lesson', 'test']
    );

    const student = await login('student@itscool.local', 'student123');
    const parent = await login('parent@itscool.local', 'parent123');
    const deniedStudent = await api('/api/outline/courses', { token: student.data.token });
    const deniedParent = await api(`/api/outline/courses/${courseId}/blocks`, {
      method: 'POST',
      token: parent.data.token,
      body: { type: 'lesson' },
    });
    assert.equal(deniedStudent.status, 403);
    assert.equal(deniedParent.status, 403);

    const seen = await api(`/api/courses/${courseId}`, { token: student.data.token });
    assert.equal(seen.status, 200);
    assert.deepEqual(
      seen.data.program.map((item) => item.type),
      ['material', 'lesson', 'test']
    );
    assert.equal(seen.data.program[1].title, 'Переменные');
    assert.equal(seen.data.program[2].title, 'Проверка переменных');

    const catalog = await api(`/api/courses?q=${encodeURIComponent(title)}`);
    assert.ok(catalog.data.courses.some((course) => course.id === courseId));

    const teacher = await login('teacher@itscool.local', 'teacher123');
    const extra = await api(`/api/outline/courses/${courseId}/blocks`, {
      method: 'POST',
      token: teacher.data.token,
      body: { type: 'lesson', title: 'Добавка преподавателя', content: 'Ещё один урок' },
    });
    assert.equal(extra.status, 201, extra.data.error);

    const admin = await login('admin@itscool.local', 'admin123');
    const opened = await api(`/api/outline/courses/${courseId}`, { token: admin.data.token });
    assert.equal(opened.status, 200);
    assert.equal(opened.data.blocks.length, 4);

    const frozen = await login('accountant@itscool.local', 'accountant123');
    assert.equal(frozen.status, 403);
    const hr = await login('hr@itscool.local', 'hr1234');
    assert.equal(hr.status, 403);
  });
});
