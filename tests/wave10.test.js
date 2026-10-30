const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

const dbFile = path.join(os.tmpdir(), `itscool-w10-${process.pid}-${Date.now()}.db`);
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
  assert.equal(status, 200, data.error || 'login');
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

describe('wave10 analytics builder', () => {
  it('keeps the frozen marketer dataset split in the model', () => {
    const { datasetsFor, presetsFor } = require('../server/services/analyticsDatasets');
    const codes = datasetsFor('marketer').map((d) => d.code);
    assert.ok(codes.includes('landing_funnel'));
    assert.ok(!codes.includes('revenue_by_status'));
    const presets = presetsFor('marketer').map((p) => p.code);
    assert.ok(presets.includes('marketing_funnel'));
    assert.ok(!presets.includes('office_finance'));
  });

  it('returns meta presets and datasets', async () => {
    const { token } = await login('teacher@itscool.local', 'teacher123');
    const meta = await api('/api/analytics/meta', { token });
    assert.equal(meta.status, 200);
    assert.ok(meta.data.datasets.some((d) => d.code === 'landing_funnel'));
    assert.ok(meta.data.datasets.some((d) => d.code === 'revenue_by_status'));
    assert.ok(meta.data.presets.some((p) => p.code === 'marketing_funnel'));
  });

  it('runs funnel dataset and batch', async () => {
    const { token } = await login('teacher@itscool.local', 'teacher123');
    const funnel = await api('/api/analytics/dataset/landing_funnel', { token });
    assert.equal(funnel.status, 200);
    assert.ok(funnel.data.series.length >= 3);

    const batch = await api('/api/analytics/datasets/batch', {
      method: 'POST',
      token,
      body: { codes: ['leads_by_status', 'revenue_by_status'], days: 60 },
    });
    assert.equal(batch.status, 200);
    assert.ok(batch.data.datasets.leads_by_status);
  });

  it('creates and updates a report board', async () => {
    const { token } = await login('teacher@itscool.local', 'teacher123');
    const created = await api('/api/analytics/boards', {
      method: 'POST',
      token,
      body: {
        title: 'Тест отчёт',
        preset_code: 'marketing_funnel',
      },
    });
    assert.equal(created.status, 201, created.data.error);
    assert.ok(created.data.board.layout.widgets.length >= 1);

    const patched = await api(`/api/analytics/boards/${created.data.board.id}`, {
      method: 'PATCH',
      token,
      body: {
        title: 'Тест отчёт 2',
        layout: {
          widgets: [
            {
              id: 'x1',
              type: 'chart',
              chartType: 'pie',
              dataset: 'leads_by_source',
              title: 'Sources',
              span: 24,
            },
          ],
        },
      },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.data.board.title, 'Тест отчёт 2');
  });

  it('builds export payload', async () => {
    const { token } = await login('admin@itscool.local', 'admin123');
    const payload = await api('/api/analytics/export-payload', {
      method: 'POST',
      token,
      body: {
        title: 'Export me',
        layout: {
          widgets: [
            { id: '1', type: 'kpi', dataset: 'landing_funnel', title: 'KPI' },
            { id: '2', type: 'chart', chartType: 'bar', dataset: 'leads_by_status', title: 'Leads' },
          ],
        },
      },
    });
    assert.equal(payload.status, 200);
    assert.equal(payload.data.widgets.length, 2);
    assert.ok(payload.data.widgets[0].data);
  });
});
