import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  List,
  Row,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { api } from '../../api';

export default function HomeworkPage() {
  const [list, setList] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [form] = Form.useForm();

  function load() {
    api('/homework')
      .then((d) => setList(d.homework))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api('/groups').then((d) => setGroups(d.groups)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    api(`/homework/${selected}`)
      .then(setDetail)
      .catch((e) => setError(e.message));
  }, [selected]);

  async function create(values) {
    try {
      await api('/homework', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          group_id: Number(values.group_id),
          due_date: values.due_date || null,
        }),
      });
      form.resetFields();
      message.success('ДЗ создано');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function review(subId) {
    await api(`/homework/submissions/${subId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'done', grade: '5' }),
    });
    setDetail(await api(`/homework/${selected}`));
    load();
  }

  const columns = [
    { title: 'Задание', dataIndex: 'title' },
    { title: 'Группа', render: (_, h) => h.group?.name },
    { title: 'Срок', dataIndex: 'due_date', render: (v) => v || '—' },
    {
      title: 'Сдано',
      render: (_, h) => `${h.stats?.submitted || 0}/${h.stats?.total || 0}`,
      width: 90,
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
        <Card styles={{ body: { padding: 0 } }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={list}
            onRow={(h) => ({
              onClick: () => setSelected(h.id),
              style: { cursor: 'pointer', background: selected === h.id ? 'var(--color-selection)' : undefined },
            })}
            pagination={{ pageSize: 8 }}
          />
        </Card>
        {detail && (
          <Card title={detail.homework.title} style={{ marginTop: 12 }}>
            <Typography.Paragraph type="secondary">{detail.homework.description}</Typography.Paragraph>
            <List
              dataSource={detail.submissions}
              renderItem={(s) => (
                <List.Item
                  actions={
                    s.status === 'submitted'
                      ? [
                          <Button key="ok" type="link" onClick={() => review(s.id)}>
                            Принять
                          </Button>,
                        ]
                      : []
                  }
                >
                  <List.Item.Meta
                    title={s.student_name}
                    description={<Tag>{s.status}</Tag>}
                  />
                </List.Item>
              )}
            />
          </Card>
        )}
      </Col>
      <Col xs={24} lg={8}>
        <Card title="Новое ДЗ">
          <Form form={form} layout="vertical" onFinish={create}>
            <Form.Item name="group_id" label="Группа" rules={[{ required: true }]}>
              <Select options={groups.map((g) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
            <Form.Item name="title" label="Название" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="description" label="Описание">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item name="due_date" label="Срок">
              <Input type="date" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>
              Создать
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}
