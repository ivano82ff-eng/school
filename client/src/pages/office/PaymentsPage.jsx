import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { api, downloadCsv } from '../../api';

function money(n) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState();
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  function load() {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    api(`/payments?${params}`)
      .then((d) => setPayments(d.payments))
      .catch((e) => setError(e.message));
    api('/payments/summary').then(setSummary).catch(() => {});
  }

  useEffect(() => {
    load();
    api('/contacts?type=student').then((d) => setStudents(d.contacts)).catch(() => {});
    api('/groups').then((d) => setGroups(d.groups)).catch(() => {});
  }, [status]);

  async function createPayment(values) {
    try {
      await api('/payments', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          contact_id: Number(values.contact_id),
          group_id: values.group_id ? Number(values.group_id) : null,
          amount: Number(values.amount),
        }),
      });
      form.resetFields();
      message.success('Платёж создан');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function markPaid(id) {
    await api(`/payments/${id}/mark-paid`, { method: 'POST' });
    load();
  }

  const columns = [
    {
      title: 'Ученик',
      render: (_, p) => (
        <div>
          <strong>{p.contact?.name}</strong>
          <div style={{ color: '#4d6b60' }}>{p.description || p.group?.name}</div>
        </div>
      ),
    },
    { title: 'Сумма', dataIndex: 'amount', render: money, width: 120 },
    { title: 'Срок', dataIndex: 'due_date', width: 120 },
    {
      title: 'Статус',
      dataIndex: 'status',
      width: 110,
      render: (s) => (
        <Tag color={s === 'paid' ? 'success' : s === 'overdue' ? 'error' : 'warning'}>{s}</Tag>
      ),
    },
    {
      title: '',
      width: 120,
      render: (_, p) =>
        p.status !== 'paid' ? (
          <Button size="small" type="primary" onClick={() => markPaid(p.id)}>
            Оплачено
          </Button>
        ) : null,
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {summary && (
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Card>
              <StatisticLike title={`Ожидают (${summary.pending.count})`} value={money(summary.pending.sum)} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <StatisticLike title={`Просрочено (${summary.overdue.count})`} value={money(summary.overdue.sum)} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <StatisticLike title={`Оплачено (${summary.paid.count})`} value={money(summary.paid.sum)} />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Select
                allowClear
                placeholder="Статус"
                style={{ width: 180 }}
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'pending', label: 'pending' },
                  { value: 'overdue', label: 'overdue' },
                  { value: 'paid', label: 'paid' },
                ]}
              />
              <Button
                onClick={() =>
                  downloadCsv('/search/export/payments.csv', 'payments.csv').catch((e) =>
                    message.error(e.message)
                  )
                }
              >
                Экспорт CSV
              </Button>
            </Space>
            {error && <Alert type="error" message={error} showIcon />}
            <Card styles={{ body: { padding: 0 } }}>
              <Table rowKey="id" columns={columns} dataSource={payments} scroll={{ x: 640 }} pagination={{ pageSize: 8 }} />
            </Card>
          </Space>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Новый платёж">
            <Form form={form} layout="vertical" onFinish={createPayment} initialValues={{ amount: 4500 }}>
              <Form.Item name="contact_id" label="Ученик" rules={[{ required: true }]}>
                <Select options={students.map((s) => ({ value: s.id, label: s.name }))} />
              </Form.Item>
              <Form.Item name="group_id" label="Группа">
                <Select allowClear options={groups.map((g) => ({ value: g.id, label: g.name }))} />
              </Form.Item>
              <Form.Item name="amount" label="Сумма" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="due_date" label="Срок" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
              <Form.Item name="description" label="Описание">
                <Input placeholder="Абонемент апрель" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                Создать
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

function StatisticLike({ title, value }) {
  return (
    <div>
      <div style={{ color: '#4d6b60', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
