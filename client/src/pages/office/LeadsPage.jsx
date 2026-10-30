import { useEffect, useState } from 'react';
import { Alert, Button, Card, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { Link } from 'react-router-dom';
import { api } from '../../api';

const LABELS = {
  new: 'Новая',
  contacted: 'Связались',
  trial: 'Пробный',
  won: 'Клиент',
  lost: 'Отказ',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [status, setStatus] = useState();
  const [error, setError] = useState('');

  function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    api(`/leads?${params}`)
      .then((d) => setLeads(d.leads))
      .catch((e) => setError(e.message));
    api('/leads/pipeline').then((d) => setPipeline(d.pipeline)).catch(() => {});
  }

  useEffect(() => {
    load();
  }, [status]);

  async function setLeadStatus(id, next) {
    await api(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
    message.success('Статус обновлён');
    load();
  }

  async function convert(id) {
    await api(`/leads/${id}/convert`, { method: 'POST' });
    message.success('Заявка превращена в контакты');
    load();
  }

  const columns = [
    {
      title: 'Родитель',
      render: (_, l) => (
        <div>
          <strong>{l.name}</strong>
          <div style={{ color: '#4d6b60' }}>{l.phone || l.email}</div>
        </div>
      ),
    },
    {
      title: 'Ребёнок',
      render: (_, l) => `${l.child_name || '—'}${l.child_grade ? ` · ${l.child_grade} кл.` : ''}`,
    },
    { title: 'Интерес', dataIndex: 'interest', render: (v) => v || '—' },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (s) => <Tag>{LABELS[s] || s}</Tag>,
    },
    {
      title: 'Действия',
      render: (_, l) => (
        <Space wrap size={4}>
          {l.status === 'new' && (
            <Button size="small" onClick={() => setLeadStatus(l.id, 'contacted')}>
              Связались
            </Button>
          )}
          {['new', 'contacted'].includes(l.status) && (
            <Button size="small" onClick={() => setLeadStatus(l.id, 'trial')}>
              Пробный
            </Button>
          )}
          {l.status !== 'won' && l.status !== 'lost' && (
            <Button size="small" type="primary" onClick={() => convert(l.id)}>
              В клиенты
            </Button>
          )}
          {l.status !== 'lost' && l.status !== 'won' && (
            <Button size="small" danger onClick={() => setLeadStatus(l.id, 'lost')}>
              Отказ
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Text type="secondary">Воронка заявок</Typography.Text>
        <Link to="/office/trials">
          <Button>Пробные уроки</Button>
        </Link>
      </Space>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
        {pipeline.map((p) => (
          <Card key={p.status} size="small" hoverable onClick={() => setStatus(p.status)}>
            <Statistic title={LABELS[p.status] || p.status} value={p.count} />
          </Card>
        ))}
      </div>
      {error && <Alert type="error" message={error} showIcon />}
      <Card styles={{ body: { padding: 0 } }}>
        <Table rowKey="id" columns={columns} dataSource={leads} scroll={{ x: 800 }} pagination={{ pageSize: 8 }} />
      </Card>
    </Space>
  );
}
