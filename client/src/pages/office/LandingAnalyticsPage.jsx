import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { DownloadOutlined, LineChartOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';
import ReportChart from '../../components/ReportChart';
import {
  exportCsv,
  exportHtml,
  exportJson,
  exportPdfFromElement,
  exportPptx,
} from '../../utils/reportExport';

export default function LandingAnalyticsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const allowed = can(user, 'marketing.analytics', 'marketing.landings');
  const [data, setData] = useState(null);
  const [charts, setCharts] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    if (!allowed) return;
    api(`/landings/${id}/analytics`)
      .then(setData)
      .catch((e) => setError(e.message));
    api('/analytics/datasets/batch', {
      method: 'POST',
      body: JSON.stringify({
        codes: ['landing_funnel', 'landing_events_by_type', 'leads_by_day'],
        landing_id: Number(id),
        days: 30,
      }),
    })
      .then((d) => setCharts(d.datasets || {}))
      .catch(() => {});
  }, [allowed, id]);

  const exportWidgets = useMemo(
    () => [
      {
        id: 'kpi',
        type: 'kpi',
        dataset: 'landing_funnel',
        title: 'KPI',
        data: charts.landing_funnel,
      },
      {
        id: 'funnel',
        type: 'chart',
        chartType: 'funnel',
        dataset: 'landing_funnel',
        title: 'Воронка',
        data: charts.landing_funnel,
      },
      {
        id: 'events',
        type: 'chart',
        chartType: 'pie',
        dataset: 'landing_events_by_type',
        title: 'События',
        data: charts.landing_events_by_type,
      },
      {
        id: 'leads',
        type: 'chart',
        chartType: 'line',
        dataset: 'leads_by_day',
        title: 'Лиды по дням',
        data: charts.leads_by_day,
      },
    ],
    [charts]
  );

  if (!allowed) return <Navigate to="/office" replace />;
  if (error) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  const s = data.summary;

  async function doExport(fmt) {
    setBusy(true);
    try {
      const payload = {
        title: `Аналитика лендинга #${id}`,
        generatedAt: new Date().toISOString(),
        widgets: exportWidgets,
      };
      if (fmt === 'csv') exportCsv(payload);
      else if (fmt === 'json') exportJson(payload);
      else if (fmt === 'html') exportHtml(payload);
      else if (fmt === 'pptx') await exportPptx(payload);
      else if (fmt === 'pdf') await exportPdfFromElement(printRef.current, `landing-${id}.pdf`);
      message.success(`Экспорт ${fmt.toUpperCase()} готов`);
    } catch (e) {
      message.error(e.message || 'Ошибка экспорта');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          <Link to="/office/landings">← Лендинги</Link>
          {' · '}
          <Link to={`/office/landings/${id}/edit`}>Редактор</Link>
          {' · '}
          <Link to={`/office/analytics?landing_id=${id}`}>Конструктор отчёта</Link>
        </Typography.Paragraph>
        <Space>
          <Link to={`/office/analytics?landing_id=${id}`}>
            <Button icon={<LineChartOutlined />}>Собрать свой отчёт</Button>
          </Link>
          <DropdownExport busy={busy} onPick={doExport} />
        </Space>
      </Space>

      <Typography.Title level={3}>Аналитика лендинга</Typography.Title>

      <div ref={printRef}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Просмотры" value={s.views} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Лиды" value={s.leads} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Конверсия %" value={s.conversion} suffix="%" />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Опросы" value={s.surveys} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <ReportChart
              widget={{ title: 'Воронка', chartType: 'funnel', dataset: 'landing_funnel' }}
              data={charts.landing_funnel || { series: [] }}
            />
          </Col>
          <Col xs={24} md={12}>
            <ReportChart
              widget={{ title: 'События', chartType: 'pie', dataset: 'landing_events_by_type' }}
              data={charts.landing_events_by_type || { series: [] }}
            />
          </Col>
          <Col xs={24}>
            <ReportChart
              widget={{ title: 'Лиды по дням', chartType: 'line', dataset: 'leads_by_day' }}
              data={charts.leads_by_day || { series: [] }}
            />
          </Col>
        </Row>

        <Card title="События" size="small">
          <Table
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15 }}
            dataSource={data.recent}
            columns={[
              { title: 'Тип', dataIndex: 'event_type', render: (v) => <Tag>{v}</Tag> },
              { title: 'Блок', dataIndex: 'block_title', render: (v) => v || '—' },
              { title: 'Сессия', dataIndex: 'session_id', ellipsis: true },
              { title: 'Когда', dataIndex: 'created_at' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

function DropdownExport({ busy, onPick }) {
  return (
    <Dropdown
      menu={{
        items: [
          { key: 'html', label: 'HTML' },
          { key: 'pdf', label: 'PDF' },
          { key: 'pptx', label: 'PPTX' },
          { key: 'csv', label: 'CSV' },
          { key: 'json', label: 'JSON' },
        ],
        onClick: ({ key }) => onPick(key),
      }}
    >
      <Button icon={<DownloadOutlined />} loading={busy}>
        Экспорт
      </Button>
    </Dropdown>
  );
}
