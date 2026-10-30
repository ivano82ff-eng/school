/**
 * Analytics datasets + report board presets for the flexible report builder.
 */

const db = require('../db');
const { parseJson } = require('./content');

const DATASETS = [
  {
    code: 'leads_by_status',
    name: 'Лиды по статусам',
    chartTypes: ['pie', 'bar', 'kpi'],
    category: 'crm',
  },
  {
    code: 'leads_by_day',
    name: 'Лиды по дням',
    chartTypes: ['line', 'bar'],
    category: 'crm',
  },
  {
    code: 'leads_by_source',
    name: 'Лиды по источникам',
    chartTypes: ['pie', 'bar'],
    category: 'crm',
  },
  {
    code: 'landing_funnel',
    name: 'Воронка лендингов',
    chartTypes: ['bar', 'funnel', 'kpi'],
    category: 'marketing',
  },
  {
    code: 'landing_events_by_type',
    name: 'События лендингов',
    chartTypes: ['pie', 'bar'],
    category: 'marketing',
  },
  {
    code: 'landings_comparison',
    name: 'Сравнение лендингов',
    chartTypes: ['bar', 'table'],
    category: 'marketing',
  },
  {
    code: 'revenue_by_status',
    name: 'Оплаты по статусам',
    chartTypes: ['pie', 'bar', 'kpi'],
    category: 'finance',
  },
  {
    code: 'revenue_trend',
    name: 'Оплаты по дням',
    chartTypes: ['line', 'bar'],
    category: 'finance',
  },
  {
    code: 'attendance_overview',
    name: 'Посещаемость',
    chartTypes: ['pie', 'bar'],
    category: 'ops',
  },
  {
    code: 'homework_pipeline',
    name: 'Домашние задания',
    chartTypes: ['pie', 'bar', 'kpi'],
    category: 'ops',
  },
];

function runDataset(code, { landingId = null, days = 30 } = {}) {
  switch (code) {
    case 'leads_by_status': {
      const rows = db
        .prepare(
          `SELECT status as name, COUNT(*) as value FROM leads GROUP BY status ORDER BY value DESC`
        )
        .all();
      return { labels: rows.map((r) => r.name), series: rows, total: rows.reduce((s, r) => s + r.value, 0) };
    }
    case 'leads_by_day': {
      const rows2 = db
        .prepare(
          `SELECT date(created_at) as name, COUNT(*) as value
           FROM leads
           WHERE created_at >= datetime('now', ?)
           GROUP BY date(created_at) ORDER BY name`
        )
        .all(`-${Number(days) || 30} days`);
      return { labels: rows2.map((r) => r.name), series: rows2 };
    }
    case 'leads_by_source': {
      const rows = db
        .prepare(
          `SELECT COALESCE(NULLIF(source,''), 'unknown') as name, COUNT(*) as value
           FROM leads GROUP BY name ORDER BY value DESC LIMIT 12`
        )
        .all();
      return { labels: rows.map((r) => r.name), series: rows };
    }
    case 'landing_funnel': {
      let pageFilter = '';
      const params = [];
      if (landingId) {
        pageFilter = ' AND page_id = ?';
        params.push(Number(landingId));
      }
      const views = db
        .prepare(
          `SELECT COUNT(*) as c FROM landing_events WHERE event_type = 'view'${pageFilter}`
        )
        .get(...params).c;
      const cta = db
        .prepare(
          `SELECT COUNT(*) as c FROM landing_events WHERE event_type IN ('cta_click','form_submit')${pageFilter}`
        )
        .get(...params).c;
      const surveys = db
        .prepare(
          `SELECT COUNT(*) as c FROM landing_events WHERE event_type = 'survey_submit'${pageFilter}`
        )
        .get(...params).c;
      const leadsSql = landingId
        ? `SELECT COUNT(*) as c FROM leads WHERE landing_page_id = ?`
        : `SELECT COUNT(*) as c FROM leads WHERE landing_page_id IS NOT NULL`;
      const leads = db.prepare(leadsSql).get(...(landingId ? [Number(landingId)] : [])).c;
      const series = [
        { name: 'Просмотры', value: views },
        { name: 'CTA / клики', value: cta },
        { name: 'Опросы', value: surveys },
        { name: 'Лиды', value: leads },
      ];
      return {
        labels: series.map((s) => s.name),
        series,
        kpis: {
          views,
          cta,
          surveys,
          leads,
          conversion: views ? Math.round((leads / views) * 1000) / 10 : 0,
        },
      };
    }
    case 'landing_events_by_type': {
      const params = [`-${Number(days) || 30} days`];
      let sql = `SELECT event_type as name, COUNT(*) as value FROM landing_events
                 WHERE created_at >= datetime('now', ?)`;
      if (landingId) {
        sql += ' AND page_id = ?';
        params.push(Number(landingId));
      }
      sql += ' GROUP BY event_type ORDER BY value DESC';
      const rows = db.prepare(sql).all(...params);
      return { labels: rows.map((r) => r.name), series: rows };
    }
    case 'landings_comparison': {
      const rows = db
        .prepare(
          `SELECT p.id, p.title as name, p.slug,
             (SELECT COUNT(*) FROM landing_events e WHERE e.page_id = p.id AND e.event_type = 'view') as views,
             (SELECT COUNT(*) FROM leads l WHERE l.landing_page_id = p.id) as leads
           FROM landing_pages p
           ORDER BY views DESC
           LIMIT 20`
        )
        .all()
        .map((r) => ({
          ...r,
          value: r.views,
          conversion: r.views ? Math.round((r.leads / r.views) * 1000) / 10 : 0,
        }));
      return {
        labels: rows.map((r) => r.name),
        series: rows.map((r) => ({ name: r.name, value: r.views, leads: r.leads, conversion: r.conversion })),
        table: rows,
      };
    }
    case 'revenue_by_status': {
      const rows = db
        .prepare(
          `SELECT status as name, COUNT(*) as count, COALESCE(SUM(amount),0) as value
           FROM payments GROUP BY status ORDER BY value DESC`
        )
        .all();
      return {
        labels: rows.map((r) => r.name),
        series: rows,
        total: rows.reduce((s, r) => s + r.value, 0),
      };
    }
    case 'revenue_trend': {
      const rows = db
        .prepare(
          `SELECT date(COALESCE(paid_at, created_at)) as name,
                  COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) as value
           FROM payments
           WHERE COALESCE(paid_at, created_at) >= datetime('now', ?)
           GROUP BY date(COALESCE(paid_at, created_at))
           ORDER BY name`
        )
        .all(`-${Number(days) || 30} days`);
      return { labels: rows.map((r) => r.name), series: rows };
    }
    case 'attendance_overview': {
      const rows = db
        .prepare(
          `SELECT status as name, COUNT(*) as value FROM attendance GROUP BY status ORDER BY value DESC`
        )
        .all();
      return { labels: rows.map((r) => r.name), series: rows };
    }
    case 'homework_pipeline': {
      const rows = db
        .prepare(
          `SELECT status as name, COUNT(*) as value FROM homework_submissions GROUP BY status ORDER BY value DESC`
        )
        .all();
      return { labels: rows.map((r) => r.name), series: rows };
    }
    default:
      return { labels: [], series: [], error: 'unknown_dataset' };
  }
}

const PRESETS = [
  {
    code: 'marketing_funnel',
    name: 'Маркетинг: воронка',
    description: 'Просмотры → CTA → опросы → лиды + источники',
    layout: {
      widgets: [
        { id: 'w1', type: 'kpi', dataset: 'landing_funnel', title: 'KPI воронки', span: 24 },
        { id: 'w2', type: 'chart', chartType: 'bar', dataset: 'landing_funnel', title: 'Воронка', span: 12 },
        { id: 'w3', type: 'chart', chartType: 'pie', dataset: 'leads_by_source', title: 'Источники лидов', span: 12 },
        { id: 'w4', type: 'chart', chartType: 'line', dataset: 'leads_by_day', title: 'Лиды по дням', span: 24 },
      ],
    },
  },
  {
    code: 'landings_board',
    name: 'Лендинги: сравнение',
    description: 'Сравнение страниц, события и конверсия',
    layout: {
      widgets: [
        { id: 'w1', type: 'chart', chartType: 'bar', dataset: 'landings_comparison', title: 'Просмотры по лендингам', span: 12 },
        { id: 'w2', type: 'chart', chartType: 'pie', dataset: 'landing_events_by_type', title: 'Типы событий', span: 12 },
        { id: 'w3', type: 'table', dataset: 'landings_comparison', title: 'Таблица лендингов', span: 24 },
      ],
    },
  },
  {
    code: 'office_finance',
    name: 'Офис: финансы',
    description: 'Оплаты, статусы и динамика',
    layout: {
      widgets: [
        { id: 'w1', type: 'chart', chartType: 'pie', dataset: 'revenue_by_status', title: 'Оплаты по статусам', span: 12 },
        { id: 'w2', type: 'chart', chartType: 'line', dataset: 'revenue_trend', title: 'Динамика оплат', span: 12 },
        { id: 'w3', type: 'chart', chartType: 'bar', dataset: 'leads_by_status', title: 'CRM статусы', span: 12 },
        { id: 'w4', type: 'chart', chartType: 'pie', dataset: 'homework_pipeline', title: 'ДЗ', span: 12 },
      ],
    },
  },
  {
    code: 'ops_pulse',
    name: 'Операции: пульс школы',
    description: 'Посещаемость, ДЗ, лиды',
    layout: {
      widgets: [
        { id: 'w1', type: 'chart', chartType: 'pie', dataset: 'attendance_overview', title: 'Посещаемость', span: 8 },
        { id: 'w2', type: 'chart', chartType: 'bar', dataset: 'homework_pipeline', title: 'Домашка', span: 8 },
        { id: 'w3', type: 'chart', chartType: 'bar', dataset: 'leads_by_status', title: 'Лиды', span: 8 },
        { id: 'w4', type: 'chart', chartType: 'line', dataset: 'leads_by_day', title: 'Лиды по дням', span: 24 },
      ],
    },
  },
  {
    code: 'blank',
    name: 'Пустой отчёт',
    description: 'Соберите сами из виджетов',
    layout: { widgets: [] },
  },
];

function serializeBoard(row) {
  if (!row) return null;
  return {
    ...row,
    layout: parseJson(row.layout_json, { widgets: [] }),
    shared: row.shared !== 0,
  };
}

module.exports = {
  DATASETS,
  PRESETS,
  runDataset,
  serializeBoard,
};
