import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import dayjs from 'dayjs';
import { api } from '../../api';

const LABELS = {
  scheduled: 'Назначен',
  done: 'Проведён',
  no_show: 'Не пришёл',
  converted: 'Стал клиентом',
  cancelled: 'Отменён',
};

export default function TrialsPage() {
  const [trials, setTrials] = useState([]);
  const [leads, setLeads] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  function load() {
    api('/trials')
      .then((d) => setTrials(d.trials || []))
      .catch((e) => setError(e.message));
    api('/leads')
      .then((d) => setLeads(d.leads || []))
      .catch(() => {});
    api('/courses')
      .then((d) => setCourses(d.courses || []))
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  async function create(values) {
    try {
      const starts = values.range[0];
      const ends = values.range[1];
      await api('/trials', {
        method: 'POST',
        body: JSON.stringify({
          lead_id: values.lead_id,
          course_id: values.course_id,
          title: values.title,
          location: values.location,
          starts_at: starts.format('YYYY-MM-DD HH:mm:ss'),
          ends_at: ends.format('YYYY-MM-DD HH:mm:ss'),
        }),
      });
      message.success('Пробный урок назначен');
      setOpen(false);
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function setStatus(id, status, outcome_notes = '') {
    try {
      await api(`/trials/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, outcome_notes }),
      });
      message.success('Статус обновлён');
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  const columns = [
    {
      title: 'Когда',
      dataIndex: 'starts_at',
      render: (v, r) => (
        <div>
          <div>{v}</div>
          <Typography.Text type="secondary">{r.location || 'онлайн/школа'}</Typography.Text>
        </div>
      ),
    },
    {
      title: 'Заявка',
      render: (_, t) => (
        <div>
          <strong>{t.lead?.child_name || t.lead?.name}</strong>
          <div>
            <Typography.Text type="secondary">
              {t.lead?.name} · {t.lead?.phone || t.lead?.email}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Курс / тема',
      render: (_, t) => t.course?.title || t.title,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (s) => <Tag>{LABELS[s] || s}</Tag>,
    },
    {
      title: 'Действия',
      render: (_, t) =>
        t.status === 'scheduled' ? (
          <Space wrap size={4}>
            <Button size="small" type="primary" onClick={() => setStatus(t.id, 'done', 'Урок проведён')}>
              Проведён
            </Button>
            <Button size="small" onClick={() => setStatus(t.id, 'converted', 'Записались после пробы')}>
              В клиенты
            </Button>
            <Button size="small" danger onClick={() => setStatus(t.id, 'no_show', 'Не пришли')}>
              Не пришёл
            </Button>
          </Space>
        ) : (
          <Typography.Text type="secondary">{t.outcome_notes || '—'}</Typography.Text>
        ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Пробные уроки
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Назначение пробных из CRM и фиксация результата
          </Typography.Paragraph>
        </div>
        <Button type="primary" onClick={() => setOpen(true)}>
          Назначить
        </Button>
      </Space>

      {error && <Alert type="error" message={error} showIcon />}

      <Card size="small">
        <Table rowKey="id" dataSource={trials} columns={columns} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="Новый пробный урок" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form
          layout="vertical"
          onFinish={create}
          initialValues={{
            title: 'Пробное занятие',
            range: [dayjs().add(1, 'day').hour(16).minute(0), dayjs().add(1, 'day').hour(17).minute(0)],
          }}
        >
          <Form.Item name="lead_id" label="Заявка CRM" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={leads
                .filter((l) => !['won', 'lost'].includes(l.status))
                .map((l) => ({
                  value: l.id,
                  label: `${l.child_name || l.name} · ${l.name} (${l.status})`,
                }))}
            />
          </Form.Item>
          <Form.Item name="course_id" label="Курс (опционально)">
            <Select
              allowClear
              options={courses.map((c) => ({ value: c.id, label: `${c.icon} ${c.title}` }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Тема">
            <Input />
          </Form.Item>
          <Form.Item name="range" label="Время" rules={[{ required: true }]}>
            <DatePicker.RangePicker showTime format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="location" label="Место / ссылка">
            <Input placeholder="Кабинет 2 / Zoom" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Сохранить
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
