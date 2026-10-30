import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, Col, Empty, Row, Statistic, Table, Typography } from 'antd';

const COLORS = ['#8E6FAF', '#1F7A8C', '#E07A5F', '#2D6A4F', '#E09F3E', '#4CC9F0', '#C0392B', '#6A5285'];

export default function ReportChart({ widget, data, height = 280 }) {
  const series = data?.series || [];
  const chartType = widget.chartType || widget.type;
  const title = widget.title || widget.dataset;

  if (!series.length && chartType !== 'kpi' && chartType !== 'table') {
    return (
      <Card title={title} size="small">
        <Empty description="Нет данных" />
      </Card>
    );
  }

  if (chartType === 'kpi' || widget.type === 'kpi') {
    const kpis = data?.kpis;
    if (kpis) {
      return (
        <Card title={title} size="small">
          <Row gutter={[12, 12]}>
            {Object.entries(kpis).map(([k, v]) => (
              <Col xs={12} md={6} key={k}>
                <Statistic title={k} value={v} suffix={k === 'conversion' ? '%' : undefined} />
              </Col>
            ))}
          </Row>
        </Card>
      );
    }
    const total = data?.total ?? series.reduce((s, r) => s + (Number(r.value) || 0), 0);
    return (
      <Card title={title} size="small">
        <Row gutter={12}>
          <Col span={8}>
            <Statistic title="Всего" value={total} />
          </Col>
          {series.slice(0, 3).map((r) => (
            <Col span={8} key={r.name}>
              <Statistic title={r.name} value={r.value} />
            </Col>
          ))}
        </Row>
      </Card>
    );
  }

  if (chartType === 'table' || widget.type === 'table') {
    const rows = data?.table || series;
    const cols = rows[0]
      ? Object.keys(rows[0])
          .filter((k) => k !== 'id')
          .map((k) => ({ title: k, dataIndex: k, key: k }))
      : [];
    return (
      <Card title={title} size="small">
        <Table size="small" rowKey={(r, i) => r.id || r.name || i} dataSource={rows} columns={cols} pagination={{ pageSize: 8 }} />
      </Card>
    );
  }

  if (chartType === 'pie') {
    return (
      <Card title={title} size="small">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={series} dataKey="value" nameKey="name" outerRadius={100} label>
              {series.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  if (chartType === 'line') {
    return (
      <Card title={title} size="small">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" hide={series.length > 14} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} name="Значение" />
            {series[0]?.leads != null && (
              <Line type="monotone" dataKey="leads" stroke={COLORS[1]} strokeWidth={2} name="Лиды" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    );
  }

  // bar + funnel
  return (
    <Card title={title} size="small">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={series} layout={chartType === 'funnel' ? 'vertical' : 'horizontal'}>
          <CartesianGrid strokeDasharray="3 3" />
          {chartType === 'funnel' ? (
            <>
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={100} />
            </>
          ) : (
            <>
              <XAxis dataKey="name" hide={series.length > 10} />
              <YAxis />
            </>
          )}
          <Tooltip />
          <Legend />
          <Bar dataKey="value" name="Значение" fill={COLORS[0]} radius={[4, 4, 0, 0]}>
            {series.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
          {series[0]?.leads != null && <Bar dataKey="leads" name="Лиды" fill={COLORS[1]} />}
        </BarChart>
      </ResponsiveContainer>
      {chartType === 'funnel' && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
          Воронка: сверху вниз по этапам
        </Typography.Paragraph>
      )}
    </Card>
  );
}
