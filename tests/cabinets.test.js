const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-cabinets-${process.pid}-${Date.now()}.db`);
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
  assert.equal(res.status, 200, res.data.error || email);
  return res.data;
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

describe('personal cabinets', () => {
  it('lets a teacher message one student, the whole course, and set grades', async () => {
    const teacher = await login('teacher@itscool.local', 'teacher123');
    const student = await login('student@itscool.local', 'student123');
    const parent = await login('parent@itscool.local', 'parent123');
    const courses = await api('/api/courses?q=Python', { token: teacher.token });
    const course = courses.data.courses.find((item) => item.title.startsWith('Python'));
    assert.ok(course);

    const sheet = await api(`/api/gradebook/course/${course.id}`, { token: teacher.token });
    assert.equal(sheet.status, 200, sheet.data.error);
    const pupil = sheet.data.students.find((item) => item.name.includes('Максим'));
    assert.ok(pupil?.user_id);
    const cell = pupil.grades.find((grade) => grade.submission_id);
    assert.ok(cell);

    const graded = await api(`/api/homework/submissions/${cell.submission_id}`, {
      method: 'PATCH',
      token: teacher.token,
      body: { grade: '4' },
    });
    assert.equal(graded.status, 200, graded.data.error);

    const mine = await api('/api/gradebook/me', { token: student.token });
    assert.equal(mine.status, 200);
    const seenGrade = mine.data.groups.some((group) =>
      (group.student?.homework || []).some((row) => row.grade === '4')
    );
    assert.equal(seenGrade, true);

    const family = await api('/api/parent/dashboard', { token: parent.token });
    assert.equal(family.status, 200);
    const child = family.data.children[0];
    assert.ok(Array.isArray(child.attendanceMarks));
    assert.ok(child.payments.some((bill) => bill.id && bill.amount));
    const parentSees = child.grades.some((group) =>
      (group.homework || []).some((row) => row.grade === '4')
    );
    assert.equal(parentSees, true);

    const direct = await api('/api/messages/threads', {
      method: 'POST',
      token: teacher.token,
      body: {
        subject: 'Лично Максиму',
        body: 'Проверь тетрадь',
        contactId: pupil.contact_id,
        participantIds: [pupil.user_id],
      },
    });
    assert.equal(direct.status, 201, direct.data.error);

    const broadcast = await api('/api/messages/course', {
      method: 'POST',
      token: teacher.token,
      body: { courseId: course.id, subject: 'Всем по Python', body: 'Завтра повторяем циклы' },
    });
    assert.equal(broadcast.status, 201, broadcast.data.error);
    assert.ok(broadcast.data.sent >= 1);

    const inbox = await api('/api/messages/threads', { token: student.token });
    const subjects = (inbox.data.threads || []).map((thread) => thread.subject);
    assert.ok(subjects.includes('Лично Максиму'));
    assert.ok(subjects.includes('Всем по Python'));

    const dash = await api('/api/student/dashboard', { token: student.token });
    assert.equal(dash.status, 200);
    assert.ok(Array.isArray(dash.data.materials));
    assert.ok(dash.data.materials.length >= 1);

    const deniedStudent = await api('/api/messages/course', {
      method: 'POST',
      token: student.token,
      body: { courseId: course.id, subject: 'нет', body: 'нет' },
    });
    const deniedParent = await api(`/api/gradebook/course/${course.id}`, { token: parent.token });
    assert.equal(deniedStudent.status, 403);
    assert.equal(deniedParent.status, 403);

    const methodist = await login('methodist@itscool.local', 'methodist123');
    const methodistSheet = await api(`/api/gradebook/course/${course.id}`, { token: methodist.token });
    const methodistSend = await api('/api/messages/course', {
      method: 'POST',
      token: methodist.token,
      body: { courseId: course.id, subject: 'нет', body: 'нет' },
    });
    assert.equal(methodistSheet.status, 403);
    assert.equal(methodistSend.status, 403);

    const admin = await login('admin@itscool.local', 'admin123');
    const summary = await api('/api/admin/summary', { token: admin.token });
    assert.equal(summary.status, 200);
    assert.ok(summary.data.students >= 1);
    assert.ok(summary.data.bills.overdueCount >= 0);
    const teacherSummary = await api('/api/admin/summary', { token: teacher.token });
    assert.equal(teacherSummary.status, 403);

    const accountant = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'accountant@itscool.local', password: 'accountant123' },
    });
    assert.equal(accountant.status, 403);
  });

  it('lets a student message the school or one teacher, without documents', async () => {
    const student = await login('student@itscool.local', 'student123');
    assert.equal(student.user.permissions.includes('documents.access'), false);
    const docs = await api('/api/documents', { token: student.token });
    assert.equal(docs.status, 403);

    const parent = await login('parent@itscool.local', 'parent123');
    const parentDocs = await api('/api/documents', { token: parent.token });
    assert.equal(parentDocs.status, 200);

    const teachers = await api('/api/messages/teachers', { token: student.token });
    assert.equal(teachers.status, 200, teachers.data.error);
    const anna = teachers.data.teachers.find((item) => item.name.includes('Анна'));
    assert.ok(anna);

    const school = await api('/api/messages/threads', {
      method: 'POST',
      token: student.token,
      body: { subject: 'Вопрос школе', body: 'Можно перенести занятие?' },
    });
    assert.equal(school.status, 201, school.data.error);
    const schoolRoles = school.data.thread.participants.map((person) => person.role);
    assert.ok(schoolRoles.includes('teacher'));
    assert.ok(schoolRoles.includes('admin'));

    const direct = await api('/api/messages/threads', {
      method: 'POST',
      token: student.token,
      body: { subject: 'Лично Анне', body: 'Не понял задачу', teacherId: anna.id },
    });
    assert.equal(direct.status, 201, direct.data.error);
    const people = direct.data.thread.participants;
    assert.equal(people.length, 2);
    assert.ok(people.some((person) => person.role === 'student'));
    assert.ok(people.some((person) => person.id === anna.id && person.role === 'teacher'));

    const dash = await api('/api/student/dashboard', { token: student.token });
    assert.equal(dash.status, 200);
    assert.ok(dash.data.materials.length >= 1);
    assert.ok(Array.isArray(dash.data.attendance));
  });
});
