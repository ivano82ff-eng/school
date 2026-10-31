const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-rbac-${process.pid}-${Date.now()}.db`);
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
  assert.equal(status, 200, data.error || 'login failed');
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

describe('wave8 rbac', () => {
  it('admin has full permissions and can list users', async () => {
    const { token, user } = await login('admin@itscool.local', 'admin123');
    assert.ok(user.permissions.includes('*') || user.role === 'admin');
    assert.equal(user.flags.admin, true);
    const { status, data } = await api('/api/admin/users', { token });
    assert.equal(status, 200);
    assert.ok(data.users.length >= 8);
  });

  it('frozen roles stay in the database but cannot sign in', async () => {
    const { hasPermission } = require('../server/services/rbac');
    assert.equal(hasPermission('accountant', 'office.payments'), true);
    assert.equal(hasPermission('accountant', 'content.builder'), false);
    assert.equal(hasPermission('marketer', 'office.leads'), true);
    assert.equal(hasPermission('marketer', 'office.payments'), false);

    const { token } = await login('admin@itscool.local', 'admin123');
    const listed = await api('/api/admin/users', { token });
    const frozen = [
      ['accountant@itscool.local', 'accountant123'],
      ['hr@itscool.local', 'hr1234'],
      ['analyst@itscool.local', 'analyst123'],
      ['marketer@itscool.local', 'marketer123'],
    ];
    for (const [email, password] of frozen) {
      assert.ok(listed.data.users.some((u) => u.email === email));
      const denied = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      assert.equal(denied.status, 403);
    }

    const methodist = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'methodist@itscool.local', password: 'methodist123' },
    });
    assert.equal(methodist.status, 200);
    assert.equal(methodist.data.user.flags.content, true);
    assert.equal(methodist.data.user.flags.office, false);
    assert.deepEqual(
      [...methodist.data.user.permissions].sort(),
      ['content.builder', 'content.teach']
    );
  });

  it('admin cannot assign a frozen role and can assign teacher', async () => {
    const { token } = await login('admin@itscool.local', 'admin123');
    const email = `curator-${Date.now()}@itscool.local`;
    const frozen = await api('/api/admin/users', {
      method: 'POST',
      token,
      body: {
        email,
        name: 'Тест Куратор',
        password: 'test1234',
        role: 'accountant',
      },
    });
    assert.equal(frozen.status, 400);

    const created = await api('/api/admin/users', {
      method: 'POST',
      token,
      body: {
        email,
        name: 'Тест Куратор',
        password: 'test1234',
        role: 'teacher',
      },
    });
    assert.equal(created.status, 201, created.data.error);
    assert.equal(created.data.user.role, 'teacher');
  });

  it('admin can tweak role permissions', async () => {
    const { token } = await login('admin@itscool.local', 'admin123');
    const roles = await api('/api/admin/roles', { token });
    assert.equal(roles.status, 200);
    const analyst = roles.data.roles.find((r) => r.code === 'analyst');
    assert.ok(analyst);
    const next = [...new Set([...(analyst.permissions || []), 'office.leads'])];
    const patched = await api('/api/admin/roles/analyst', {
      method: 'PATCH',
      token,
      body: { permissions: next },
    });
    assert.equal(patched.status, 200);
    assert.ok(patched.data.role.permissions.includes('office.leads'));
    assert.equal(patched.data.role.live, false);

    const turnedOn = await api('/api/admin/roles/analyst', {
      method: 'PATCH',
      token,
      body: { active: true },
    });
    assert.equal(turnedOn.status, 400);
  });

  it('inactive user cannot login', async () => {
    const { token } = await login('admin@itscool.local', 'admin123');
    const email = `blocked-${Date.now()}@itscool.local`;
    const created = await api('/api/admin/users', {
      method: 'POST',
      token,
      body: { email, name: 'Blocked', password: 'block123', role: 'student', grade: 5 },
    });
    assert.equal(created.status, 201);
    const id = created.data.user.id;
    await api(`/api/admin/users/${id}`, {
      method: 'PATCH',
      token,
      body: { active: false },
    });
    const denied = await api('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'block123' },
    });
    assert.equal(denied.status, 403);
  });
});
