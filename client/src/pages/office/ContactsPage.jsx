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
  Typography,
  message,
} from 'antd';
import { api } from '../../api';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [type, setType] = useState();
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  function load() {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (q.trim()) params.set('q', q.trim());
    api(`/contacts?${params}`)
      .then((d) => setContacts(d.contacts))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, [type, q]);

  async function onCreate(values) {
    try {
      await api('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          grade: values.type === 'student' ? Number(values.grade) : null,
        }),
      });
      form.resetFields();
      message.success('Контакт создан');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const columns = [
    {
      title: 'Имя',
      dataIndex: 'name',
      render: (name, c) => (
        <div>
          <Typography.Text strong>{name}</Typography.Text>
          <div>
            <Typography.Text type="secondary">{c.email}</Typography.Text>
          </div>
        </div>
      ),
    },
    { title: 'Тип', dataIndex: 'type', width: 100 },
    { title: 'Класс', dataIndex: 'grade', width: 80, render: (g) => g || '—' },
    { title: 'Телефон', dataIndex: 'phone', render: (p) => p || '—' },
    {
      title: 'Связи',
      render: (_, c) =>
        c.type === 'student'
          ? (c.parents || []).map((p) => p.name).join(', ') || '—'
          : (c.children || []).map((ch) => ch.name).join(', ') || '—',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Space wrap>
            <Select
              allowClear
              placeholder="Тип"
              style={{ width: 160 }}
              value={type}
              onChange={setType}
              options={[
                { value: 'student', label: 'Ученики' },
                { value: 'parent', label: 'Родители' },
              ]}
            />
            <Input.Search
              allowClear
              placeholder="Поиск"
              style={{ width: 240 }}
              onSearch={setQ}
              onChange={(e) => !e.target.value && setQ('')}
            />
          </Space>
          {error && <Alert type="error" message={error} showIcon />}
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={contacts}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 640 }}
            />
          </Card>
        </Space>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Новый контакт">
          <Form form={form} layout="vertical" onFinish={onCreate} initialValues={{ type: 'student', grade: 7 }}>
            <Form.Item name="type" label="Тип" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'student', label: 'Ученик' },
                  { value: 'parent', label: 'Родитель' },
                  { value: 'other', label: 'Другое' },
                ]}
              />
            </Form.Item>
            <Form.Item name="name" label="Имя" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Телефон">
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email">
              <Input type="email" />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, c) => p.type !== c.type}>
              {({ getFieldValue }) =>
                getFieldValue('type') === 'student' ? (
                  <Form.Item name="grade" label="Класс">
                    <Select options={Array.from({ length: 11 }, (_, i) => ({ value: i + 1, label: i + 1 }))} />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <Form.Item name="notes" label="Заметка">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Сохранить
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
