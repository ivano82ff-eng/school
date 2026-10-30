import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
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
  Statistic,
  Typography,
  message,
} from 'antd';
import { api } from '../api';
import { useAuth } from '../auth';
import { flag } from '../permissions';

export default function Teacher() {
  const { user } = useAuth();
  const allowed = flag(user, 'content');
  const [stats, setStats] = useState(null);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [courseForm] = Form.useForm();
  const [lessonForm] = Form.useForm();

  useEffect(() => {
    if (!allowed) return;
    api('/auth/stats').then(setStats).catch(() => {});
    api('/courses')
      .then((d) => setCourses(d.courses))
      .catch((e) => setError(e.message));
  }, [allowed]);

  if (!allowed) return <Navigate to="/dashboard" replace />;

  async function createCourse(values) {
    try {
      await api('/courses', { method: 'POST', body: JSON.stringify(values) });
      courseForm.resetFields();
      message.success('Курс создан');
      setCourses((await api('/courses')).courses);
      setStats(await api('/auth/stats'));
    } catch (err) {
      setError(err.message);
    }
  }

  async function createLesson(values) {
    try {
      await api('/lessons', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          course_id: Number(values.course_id),
          duration_min: Number(values.duration_min),
        }),
      });
      lessonForm.setFieldsValue({ title: '', content: '' });
      message.success('Урок добавлен');
      setStats(await api('/auth/stats'));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>Кабинет преподавателя</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Создавай курсы и собирай уроки в конструкторе блоков (файлы, тесты, виджеты, оценки).
        </p>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      <Card title="Конструктор курсов" size="small">
        <Typography.Paragraph type="secondary">
          Гибкая сборка: разделы, блоки, презентации, quiz с автооценкой в дневник, share-ссылки.
        </Typography.Paragraph>
        <Space wrap>
          {courses.map((c) => (
            <Link key={c.id} to={`/teacher/builder/${c.id}`}>
              <Button type="primary">
                {c.icon} {c.title}
              </Button>
            </Link>
          ))}
          {!courses.length && <Typography.Text type="secondary">Сначала создайте курс ниже</Typography.Text>}
        </Space>
      </Card>

      {stats && (
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Учеников" value={stats.students} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Курсов" value={stats.courses} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Уроков" value={stats.lessons} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic title="Записей" value={stats.enrollments} />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Новый курс">
            <Form
              form={courseForm}
              layout="vertical"
              onFinish={createCourse}
              initialValues={{
                category: 'Программирование',
                grade_min: 5,
                grade_max: 9,
                cover_color: '#2563eb',
                icon: '💻',
              }}
            >
              <Form.Item name="title" label="Название" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="Описание" rules={[{ required: true }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item name="category" label="Категория" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="grade_min" label="Класс от">
                    <InputNumber min={1} max={11} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="grade_max" label="Класс до">
                    <InputNumber min={1} max={11} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="cover_color" label="Цвет">
                    <Input type="color" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="icon" label="Иконка">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" block>
                Создать курс
              </Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Новый урок">
            <Form form={lessonForm} layout="vertical" onFinish={createLesson} initialValues={{ duration_min: 25 }}>
              <Form.Item name="course_id" label="Курс" rules={[{ required: true }]}>
                <Select options={courses.map((c) => ({ value: c.id, label: c.title }))} />
              </Form.Item>
              <Form.Item name="title" label="Название урока" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="content" label="Содержание (Markdown)" rules={[{ required: true }]}>
                <Input.TextArea rows={8} placeholder="# Заголовок" />
              </Form.Item>
              <Form.Item name="duration_min" label="Длительность (мин)">
                <InputNumber min={5} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                Добавить урок
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
