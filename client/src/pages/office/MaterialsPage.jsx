import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  List,
  Select,
  Space,
  Typography,
} from 'antd';
import { DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import { api } from '../../api';

export default function MaterialsPage() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function loadCourses() {
    return api('/courses').then((d) => {
      setCourses(d.courses || []);
      if (!courseId && d.courses?.[0]) setCourseId(d.courses[0].id);
    });
  }

  function loadMaterials(cid = courseId) {
    if (!cid) return;
    return api(`/materials?course_id=${cid}`).then((d) => setMaterials(d.materials || []));
  }

  useEffect(() => {
    loadCourses().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (courseId) loadMaterials(courseId).catch((e) => setError(e.message));
  }, [courseId]);

  async function onCreate(values) {
    setError('');
    setMessage('');
    try {
      await api('/materials', {
        method: 'POST',
        body: JSON.stringify({ ...values, course_id: courseId }),
      });
      setMessage('Материал добавлен');
      await loadMaterials();
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    try {
      await api(`/materials/${id}`, { method: 'DELETE' });
      await loadMaterials();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Материалы курсов
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Ссылки и шпаргалки для учеников
        </Typography.Paragraph>
      </div>

      {error && <Alert type="error" message={error} showIcon />}
      {message && <Alert type="success" message={message} showIcon />}

      <Select
        style={{ minWidth: 320 }}
        value={courseId}
        onChange={setCourseId}
        options={courses.map((c) => ({ value: c.id, label: `${c.icon} ${c.title}` }))}
      />

      <Card title="Добавить" size="small">
        <Form layout="vertical" onFinish={onCreate} style={{ maxWidth: 560 }}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="url" label="Ссылка">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="sort_order" label="Порядок" initialValue={0}>
            <InputNumber min={0} />
          </Form.Item>
          <Button type="primary" htmlType="submit" disabled={!courseId}>
            Сохранить
          </Button>
        </Form>
      </Card>

      <Card title="Список" size="small">
        <List
          dataSource={materials}
          locale={{ emptyText: 'Пока нет материалов' }}
          renderItem={(m) => (
            <List.Item
              actions={[
                <Button
                  key="del"
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(m.id)}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  m.url ? (
                    <a href={m.url} target="_blank" rel="noreferrer">
                      <LinkOutlined /> {m.title}
                    </a>
                  ) : (
                    m.title
                  )
                }
                description={m.description}
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}
