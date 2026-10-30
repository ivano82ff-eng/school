import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Input, Row, Select, Table, message } from 'antd';
import { api } from '../../api';

export default function AnnouncementsPage() {
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  function load() {
    api('/announcements')
      .then((d) => setList(d.announcements))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(values) {
    try {
      await api('/announcements', { method: 'POST', body: JSON.stringify(values) });
      form.resetFields();
      message.success('Объявление опубликовано');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    await api(`/announcements/${id}`, { method: 'DELETE' });
    load();
  }

  const columns = [
    {
      title: 'Заголовок',
      render: (_, a) => (
        <div>
          <strong>{a.title}</strong>
          <div style={{ color: '#4d6b60' }}>{a.body}</div>
        </div>
      ),
    },
    { title: 'Аудитория', dataIndex: 'audience', width: 120 },
    { title: 'Автор', dataIndex: 'author_name', width: 140 },
    {
      title: '',
      width: 100,
      render: (_, a) => (
        <Button type="link" danger onClick={() => remove(a.id)}>
          Удалить
        </Button>
      ),
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
        <Card styles={{ body: { padding: 0 } }}>
          <Table rowKey="id" columns={columns} dataSource={list} pagination={{ pageSize: 8 }} />
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Новое объявление">
          <Form form={form} layout="vertical" onFinish={create} initialValues={{ audience: 'all' }}>
            <Form.Item name="title" label="Заголовок" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="body" label="Текст" rules={[{ required: true }]}>
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item name="audience" label="Кому">
              <Select
                options={[
                  { value: 'all', label: 'Всем' },
                  { value: 'students', label: 'Ученикам' },
                  { value: 'parents', label: 'Родителям' },
                  { value: 'staff', label: 'Сотрудникам' },
                ]}
              />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Опубликовать
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
