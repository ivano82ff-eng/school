import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { api } from '../../api';

function fmt(s) {
  if (!s) return '—';
  return new Date(s.replace(' ', 'T')).toLocaleString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SchedulePage() {
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  function load() {
    api('/schedule')
      .then((d) => setSessions(d.sessions))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api('/groups').then((d) => setGroups(d.groups)).catch(() => {});
  }, []);

  async function createSession(values) {
    try {
      await api('/schedule', {
        method: 'POST',
        body: JSON.stringify({
          group_id: Number(values.group_id),
          title: values.title,
          starts_at: values.starts_at.replace('T', ' '),
          ends_at: values.ends_at.replace('T', ' '),
          location: values.location,
        }),
      });
      form.resetFields();
      message.success('Занятие добавлено');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(id, status) {
    await api(`/schedule/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    load();
  }

  const columns = [
    {
      title: 'Когда',
      render: (_, s) => (
        <div>
          <strong>{fmt(s.starts_at)}</strong>
          <div style={{ color: '#4d6b60' }}>до {fmt(s.ends_at)}</div>
        </div>
      ),
    },
    {
      title: 'Группа',
      render: (_, s) => (
        <div>
          {s.group?.name}
          <div style={{ color: '#4d6b60' }}>{s.membersCount} уч.</div>
        </div>
      ),
    },
    { title: 'Тема', dataIndex: 'title', render: (t) => t || 'Занятие' },
    { title: 'Где', dataIndex: 'location', render: (v) => v || '—' },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (s) => <Tag color={s === 'done' ? 'success' : s === 'cancelled' ? 'error' : 'processing'}>{s}</Tag>,
    },
    {
      title: '',
      render: (_, s) =>
        s.status === 'planned' ? (
          <Space>
            <Button size="small" type="primary" onClick={() => setStatus(s.id, 'done')}>
              Проведено
            </Button>
            <Button size="small" onClick={() => setStatus(s.id, 'cancelled')}>
              Отмена
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
        <Card styles={{ body: { padding: 0 } }}>
          <Table rowKey="id" columns={columns} dataSource={sessions} scroll={{ x: 800 }} pagination={{ pageSize: 8 }} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Новое занятие">
          <Form form={form} layout="vertical" onFinish={createSession}>
            <Form.Item name="group_id" label="Группа" rules={[{ required: true }]}>
              <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
            <Form.Item name="title" label="Тема">
              <Input placeholder="Циклы while" />
            </Form.Item>
            <Form.Item name="starts_at" label="Начало" rules={[{ required: true }]}>
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="ends_at" label="Конец" rules={[{ required: true }]}>
              <Input type="datetime-local" />
            </Form.Item>
            <Form.Item name="location" label="Место / ссылка">
              <Input placeholder="Zoom / ауд. 3" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Добавить
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
