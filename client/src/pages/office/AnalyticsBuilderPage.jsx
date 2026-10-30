import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
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

function uid() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function AnalyticsBuilderPage() {
  const { user } = useAuth();
  const allowed = can(user, 'office.reports', 'marketing.analytics', 'marketing.landings');
  const [params] = useSearchParams();
  const landingId = params.get('landing_id');

  const [meta, setMeta] = useState({ datasets: [], presets: [] });
  const [boards, setBoards] = useState([]);
  const [boardId, setBoardId] = useState(null);
  const [title, setTitle] = useState('Новый отчёт');
  const [widgets, setWidgets] = useState([]);
  const [datasetMap, setDatasetMap] = useState({});
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [form] = Form.useForm();
  const [saveForm] = Form.useForm();
  const printRef = useRef(null);

  useEffect(() => {
    if (!allowed) return;
    Promise.all([api('/analytics/meta'), api('/analytics/boards')])
      .then(([m, b]) => {
        setMeta(m);
        setBoards(b.boards || []);
      })
      .catch((e) => setError(e.message));
  }, [allowed]);

  const codes = useMemo(
    () => [...new Set(widgets.map((w) => w.dataset).filter(Boolean))],
    [widgets]
  );

  useEffect(() => {
    if (!allowed || !codes.length) {
      setDatasetMap({});
      return;
    }
    api('/analytics/datasets/batch', {
      method: 'POST',
      body: JSON.stringify({
        codes,
        landing_id: landingId ? Number(landingId) : null,
        days,
      }),
    })
      .then((d) => setDatasetMap(d.datasets || {}))
      .catch((e) => message.error(e.message));
  }, [allowed, codes.join(','), days, landingId]);

  if (!allowed) return <Navigate to="/office" replace />;

  async function applyPreset(code) {
    const data = await api(`/analytics/presets/${code}`);
    const layout = data.preset.layout || { widgets: [] };
    setWidgets(layout.widgets.map((w) => ({ ...w, id: w.id || uid() })));
    setTitle(data.preset.name);
    setBoardId(null);
    message.success(`Шаблон «${data.preset.name}» загружен`);
  }

  async function loadBoard(id) {
    const data = await api(`/analytics/boards/${id}`);
    const b = data.board;
    setBoardId(b.id);
    setTitle(b.title);
    setWidgets((b.layout?.widgets || []).map((w) => ({ ...w, id: w.id || uid() })));
  }

  async function saveBoard(values) {
    setBusy(true);
    try {
      const layout = { widgets };
      if (boardId && !values.asNew) {
        await api(`/analytics/boards/${boardId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: values.title || title,
            description: values.description || '',
            layout,
          }),
        });
        message.success('Отчёт сохранён');
      } else {
        const created = await api('/analytics/boards', {
          method: 'POST',
          body: JSON.stringify({
            title: values.title || title,
            description: values.description || '',
            layout,
            shared: true,
          }),
        });
        setBoardId(created.board.id);
        setTitle(created.board.title);
        message.success('Отчёт создан');
      }
      setSaveOpen(false);
      setBoards((await api('/analytics/boards')).boards || []);
    } catch (e) {
      message.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function addWidget(values) {
    setWidgets((prev) => [
      ...prev,
      {
        id: uid(),
        type: values.type === 'kpi' || values.type === 'table' ? values.type : 'chart',
        chartType: values.type === 'kpi' || values.type === 'table' ? values.type : values.type,
        dataset: values.dataset,
        title: values.title || values.dataset,
        span: Number(values.span) || 12,
      },
    ]);
    setAddOpen(false);
    form.resetFields();
  }

  function removeWidget(id) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  async function buildPayload() {
    const data = await api('/analytics/export-payload', {
      method: 'POST',
      body: JSON.stringify({
        title,
        layout: { widgets },
        landing_id: landingId ? Number(landingId) : null,
        days,
      }),
    });
    return data;
  }

  async function doExport(fmt) {
    setBusy(true);
    try {
      const payload = await buildPayload();
      if (fmt === 'csv') exportCsv(payload);
      else if (fmt === 'json') exportJson(payload);
      else if (fmt === 'html') exportHtml(payload);
      else if (fmt === 'pptx') await exportPptx(payload);
      else if (fmt === 'pdf') {
        await exportPdfFromElement(printRef.current, `${title || 'report'}.pdf`);
      }
      message.success(`Экспорт ${fmt.toUpperCase()} готов`);
    } catch (e) {
      message.error(e.message || 'Ошибка экспорта');
    } finally {
      setBusy(false);
    }
  }

  const exportMenu = {
    items: [
      { key: 'html', label: 'HTML' },
      { key: 'pdf', label: 'PDF' },
      { key: 'pptx', label: 'Презентация PPTX' },
      { key: 'csv', label: 'CSV' },
      { key: 'json', label: 'JSON' },
    ],
    onClick: ({ key }) => doExport(key),
  };

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Конструктор аналитики
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Шаблоны, графики и экспорт в HTML / PDF / PPTX / CSV
            {landingId ? ` · лендинг #${landingId}` : ''}
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Link to="/office/reports">Классические отчёты</Link>
          {landingId && <Link to={`/office/landings/${landingId}/analytics`}>К лендингу</Link>}
        </Space>
      </Space>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: 240 }}
            placeholder="Название отчёта"
          />
          <Select
            placeholder="Шаблон"
            style={{ width: 240 }}
            options={(meta.presets || []).map((p) => ({
              value: p.code,
              label: p.name,
            }))}
            onChange={(code) => applyPreset(code).catch((e) => message.error(e.message))}
          />
          <Select
            placeholder="Сохранённые"
            style={{ width: 220 }}
            allowClear
            options={boards.map((b) => ({ value: b.id, label: b.title }))}
            onChange={(id) => id && loadBoard(id).catch((e) => message.error(e.message))}
          />
          <InputNumber
            min={7}
            max={365}
            value={days}
            onChange={(v) => setDays(v || 30)}
            addonBefore="дней"
          />
          <Button icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Виджет
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => {
              saveForm.setFieldsValue({ title, description: '', asNew: !boardId });
              setSaveOpen(true);
            }}
          >
            Сохранить
          </Button>
          <Dropdown menu={exportMenu}>
            <Button icon={<DownloadOutlined />} loading={busy}>
              Экспорт
            </Button>
          </Dropdown>
        </Space>
      </Card>

      <div ref={printRef}>
        <Row gutter={[16, 16]}>
          {widgets.length === 0 && (
            <Col span={24}>
              <Card>
                <Typography.Paragraph>
                  Выберите готовый шаблон сверху или добавьте виджеты вручную.
                </Typography.Paragraph>
                <Space wrap>
                  {(meta.presets || [])
                    .filter((p) => p.code !== 'blank')
                    .map((p) => (
                      <Button key={p.code} onClick={() => applyPreset(p.code)}>
                        {p.name}
                      </Button>
                    ))}
                </Space>
              </Card>
            </Col>
          )}
          {widgets.map((w) => (
            <Col xs={24} md={w.span || 12} key={w.id}>
              <div style={{ position: 'relative' }}>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ position: 'absolute', right: 8, top: 8, zIndex: 2 }}
                  onClick={() => removeWidget(w.id)}
                />
                <ReportChart widget={w} data={datasetMap[w.dataset] || { series: [] }} />
              </div>
            </Col>
          ))}
        </Row>
      </div>

      <Modal
        title="Добавить виджет"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={addWidget}
          initialValues={{ type: 'bar', span: 12 }}
        >
          <Form.Item name="dataset" label="Датасет" rules={[{ required: true }]}>
            <Select
              options={(meta.datasets || []).map((d) => ({
                value: d.code,
                label: `${d.name} (${d.category})`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'bar', label: 'Столбцы' },
                { value: 'line', label: 'Линия' },
                { value: 'pie', label: 'Круговая' },
                { value: 'funnel', label: 'Воронка' },
                { value: 'kpi', label: 'KPI-карточки' },
                { value: 'table', label: 'Таблица' },
              ]}
            />
          </Form.Item>
          <Form.Item name="title" label="Заголовок">
            <Input />
          </Form.Item>
          <Form.Item name="span" label="Ширина (колонки из 24)">
            <Select
              options={[
                { value: 8, label: '1/3' },
                { value: 12, label: '1/2' },
                { value: 16, label: '2/3' },
                { value: 24, label: 'На всю ширину' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Добавить
          </Button>
        </Form>
      </Modal>

      <Modal
        title="Сохранить отчёт"
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={() => saveForm.submit()}
        confirmLoading={busy}
        destroyOnClose
      >
        <Form form={saveForm} layout="vertical" onFinish={saveBoard}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          {boardId && (
            <Form.Item name="asNew" label="Режим" initialValue={false}>
              <Select
                options={[
                  { value: false, label: 'Обновить текущий' },
                  { value: true, label: 'Создать копию' },
                ]}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
