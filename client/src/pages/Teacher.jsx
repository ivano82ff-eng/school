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
import { can, flag } from '../permissions';
import { CabinetGrid, CabinetShell } from '../components/CabinetShell';
import TeacherClassPanel from './TeacherClassPanel';

export default function Teacher() {
  const { user } = useAuth();
  const allowed = flag(user, 'content');
  const teaches = can(user, 'office.gradebook');
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
    <CabinetShell
      title="Кабинет преподавателя"
      subtitle="Соберите курс из уроков, проверочных и материалов на одном экране."
    >
      <Card className="cabinet-card" title="Конструктор">
        <Space direction="vertical">
          <Typography.Text>
            Новый курс собирается из блоков. Готовый курс, его уроки, проверочные и материалы
            открываются в том же конструкторе через список.
          </Typography.Text>
          <Link to="/teacher/blocks">
            <Button type="primary">Открыть конструктор</Button>
          </Link>
        </Space>
      </Card>

      {error && <Alert type="error" message={error} showIcon />}

      {teaches && <TeacherClassPanel courses={courses} />}

      <Card className="cabinet-card" title="Конструктор курсов">
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
        <CabinetGrid columns={4}>
          <Card className="cabinet-card">
            <Statistic title="Учеников" value={stats.students} />
          </Card>
          <Card className="cabinet-card">
            <Statistic title="Курсов" value={stats.courses} />
          </Card>
          <Card className="cabinet-card">
            <Statistic title="Уроков" value={stats.lessons} />
          </Card>
          <Card className="cabinet-card">
            <Statistic title="Записей" value={stats.enrollments} />
          </Card>
        </CabinetGrid>
      )}

      <CabinetGrid columns={2}>
          <Card className="cabinet-card" title="Новый курс">
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
          <Card className="cabinet-card" title="Новый урок">
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
      </CabinetGrid>
    </CabinetShell>
  );
}
