import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { api } from '../api';
import { useAuth } from '../auth';
import { can, flag } from '../permissions';

const VIS = {
  private: 'Только я',
  school: 'Школа',
  public: 'Публично',
};

export default function PortfolioPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const canCreate = flag(user, 'student') || flag(user, 'content');

  function load() {
    api('/portfolio')
      .then((d) => setProjects(d.projects || []))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    api('/courses')
      .then((d) => setCourses(d.courses || []))
      .catch(() => {});
  }, []);

  async function create(values) {
    try {
      await api('/portfolio', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('Проект добавлен');
      setOpen(false);
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function publish(id) {
    try {
      await api(`/portfolio/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'published' }),
      });
      message.success('Опубликовано');
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function remove(id) {
    try {
      await api(`/portfolio/${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Портфолио
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Проекты учеников: ссылки, стек, видимость для школы и родителей
          </Typography.Paragraph>
        </div>
        {canCreate && (
          <Button type="primary" onClick={() => setOpen(true)}>
            Добавить проект
          </Button>
        )}
      </Space>

      {error && <Alert type="error" message={error} showIcon />}

      {projects.length === 0 ? (
        <Empty description="Пока нет проектов" />
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map((p) => (
            <Col xs={24} md={12} lg={8} key={p.id}>
              <Card
                title={p.title}
                extra={<Tag>{VIS[p.visibility] || p.visibility}</Tag>}
                actions={
                  p.user_id === user.id || can(user, 'content.teach', 'content.builder')
                    ? [
                        p.status !== 'published' ? (
                          <Button type="link" key="pub" onClick={() => publish(p.id)}>
                            Опубликовать
                          </Button>
                        ) : (
                          <Tag key="ok" color="success">
                            published
                          </Tag>
                        ),
                        <Button type="link" danger key="del" onClick={() => remove(p.id)}>
                          Удалить
                        </Button>,
                      ]
                    : undefined
                }
              >
                <Typography.Paragraph type="secondary">
                  {p.owner?.name}
                  {p.course ? ` · ${p.course.icon} ${p.course.title}` : ''}
                </Typography.Paragraph>
                <Typography.Paragraph>{p.description || 'Без описания'}</Typography.Paragraph>
                {p.tech_stack && <Tag>{p.tech_stack}</Tag>}
                {p.url && (
                  <div style={{ marginTop: 8 }}>
                    <a href={p.url} target="_blank" rel="noreferrer">
                      Открыть проект
                    </a>
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal title="Новый проект" open={open} onCancel={() => setOpen(false)} footer={null} destroyOnClose>
        <Form
          layout="vertical"
          onFinish={create}
          initialValues={{ visibility: 'school', status: 'draft' }}
        >
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="url" label="Ссылка">
            <Input placeholder="https://github.com/..." />
          </Form.Item>
          <Form.Item name="tech_stack" label="Стек">
            <Input placeholder="Python, Scratch, HTML..." />
          </Form.Item>
          <Form.Item name="course_id" label="Курс">
            <Select
              allowClear
              options={courses.map((c) => ({ value: c.id, label: `${c.icon} ${c.title}` }))}
            />
          </Form.Item>
          <Form.Item name="visibility" label="Кто видит">
            <Select
              options={[
                { value: 'private', label: 'Только я' },
                { value: 'school', label: 'Школа (учителя/родители)' },
                { value: 'public', label: 'Публично на сайте' },
              ]}
            />
          </Form.Item>
          <Form.Item name="status" label="Статус">
            <Select
              options={[
                { value: 'draft', label: 'Черновик' },
                { value: 'published', label: 'Опубликован' },
              ]}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Сохранить
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
