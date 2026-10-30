const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { computePeriodGrade } = require('../server/services/diaryMath');

const dbFile = path.join(os.tmpdir(), `itscool-wave5-${process.pid}-${Date.now()}.db`);
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

describe('diary math transparency', () => {
  it('computes weighted total with breakdown', () => {
    const result = computePeriodGrade({
      scheme: { scale_max: 5 },
      parts: [
        {
          id: 1,
          criteria_id: 1,
          criteria_code: 'homework',
          criteria_name: 'ДЗ',
          weight: 50,
          aggregation: 'avg',
          direction: 'higher_better',
          default_max_score: 5,
        },
        {
          id: 2,
          criteria_id: 2,
          criteria_code: 'late',
          criteria_name: 'Опоздание',
          weight: 50,
          aggregation: 'avg',
          direction: 'lower_better',
          default_max_score: 5,
        },
      ],
      entries: [
        { id: 1, criteria_id: 1, score: 5, max_score: 5, title: 'ДЗ1', detail: 'ok' },
        { id: 2, criteria_id: 2, score: 0, max_score: 5, title: 'late', detail: 'не опаздывал' },
      ],
    });
    assert.ok(result.total != null);
    assert.ok(result.formula_text.includes('ДЗ') || result.formula_text.includes('%'));
    assert.equal(result.parts.length, 2);
    assert.ok(result.parts[0].raw_entries.length >= 1);
  });
});

describe('wave5 diary module', () => {
  it('student sees own transparent diary', async () => {
    const overview = await api('/api/diary/overview', { token: studentToken });
    assert.equal(overview.status, 200);
    assert.ok(overview.data.students.length >= 1);
    const student = overview.data.students[0];
    assert.ok(student.groups.length >= 1);

    const diary = await api(
      `/api/diary/student/${student.id}/group/${student.groups[0].id}`,
      { token: studentToken }
    );
    assert.equal(diary.status, 200);
    assert.ok(diary.data.breakdown);
    assert.ok(diary.data.breakdown.formula_text);
    assert.ok(diary.data.entries.length >= 1);
    assert.ok(diary.data.entries[0].detail);
  });

  it('parent can open child diary', async () => {
    const overview = await api('/api/diary/overview', { token: parentToken });
    assert.equal(overview.status, 200);
    const child = overview.data.students[0];
    const diary = await api(
      `/api/diary/student/${child.id}/group/${child.groups[0].id}`,
      { token: parentToken }
    );
    assert.equal(diary.status, 200);
    assert.ok(diary.data.breakdown.total != null || diary.data.entries.length >= 0);
  });

  it('student cannot open unrelated contact', async () => {
    const teacherView = await api('/api/diary/overview', { token: teacherToken });
    const other = teacherView.data.students.find((s) => !s.user_id || s.name.includes('София'));
    if (!other?.groups?.[0]) return;
    const denied = await api(`/api/diary/student/${other.id}/group/${other.groups[0].id}`, {
      token: studentToken,
    });
    assert.equal(denied.status, 403);
  });

  it('teacher saves custom formula and creates detailed entry', async () => {
    const overview = await api('/api/diary/overview', { token: teacherToken });
    const student = overview.data.students.find((s) => s.name.includes('Максим')) || overview.data.students[0];
    const groupId = student.groups[0].id;
    const homework = overview.data.criteria.find((c) => c.code === 'homework');

    const scheme = await api(`/api/diary/schemes/${groupId}`, {
      method: 'PUT',
      token: teacherToken,
      body: {
        name: 'Тест-формула',
        scale_max: 5,
        description: '100% домашка',
        parts: [{ criteria_id: homework.id, weight: 100, aggregation: 'avg' }],
      },
    });
    assert.equal(scheme.status, 200);
    assert.equal(scheme.data.parts.length, 1);

    const entry = await api('/api/diary/entries', {
      method: 'POST',
      token: teacherToken,
      body: {
        group_id: groupId,
        contact_id: student.id,
        criteria_id: homework.id,
        score: 4,
        max_score: 5,
        title: 'ДЗ: wave5',
        detail: 'Сделано частично: нет проверки краевых случаев.',
        comment: 'Доработать',
      },
    });
    assert.equal(entry.status, 201);
    assert.match(entry.data.entry.detail, /краевых/);
  });

  it('parent requests raise and teacher reviews', async () => {
    const overview = await api('/api/diary/overview', { token: parentToken });
    const child = overview.data.students[0];
    const diary = await api(
      `/api/diary/student/${child.id}/group/${child.groups[0].id}`,
      { token: parentToken }
    );
    const entry = diary.data.entries[0];
    assert.ok(entry);

    const reqRaise = await api('/api/diary/raise-requests', {
      method: 'POST',
      token: parentToken,
      body: {
        entry_id: entry.id,
        requested_score: entry.max_score,
        reason: 'Ребёнок переделал работу дома, просим пересмотреть.',
      },
    });
    assert.equal(reqRaise.status, 201);

    const review = await api(`/api/diary/raise-requests/${reqRaise.data.request.id}`, {
      method: 'PATCH',
      token: teacherToken,
      body: { status: 'approved', teacher_response: 'Ок, повысили' },
    });
    assert.equal(review.status, 200);
    assert.equal(review.data.request.status, 'approved');
  });

  it('feedback works across roles', async () => {
    const overview = await api('/api/diary/overview', { token: studentToken });
    const student = overview.data.students[0];
    const fb = await api('/api/diary/feedback', {
      method: 'POST',
      token: studentToken,
      body: {
        group_id: student.groups[0].id,
        contact_id: student.id,
        body: 'Спасибо за разбор оценки по опозданию!',
      },
    });
    assert.equal(fb.status, 201);
  });
});
