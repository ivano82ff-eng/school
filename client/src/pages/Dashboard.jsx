import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { api } from '../api';
import { useAuth } from '../auth';
import { flag, homePathFor } from '../permissions';
import { CabinetGrid, CabinetShell } from '../components/CabinetShell';
import MaterialPreview from '../components/MaterialPreview';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [notice, setNotice] = useState('');
  const [gradebook, setGradebook] = useState(null);
  const [preview, setPreview] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [schoolForm] = Form.useForm();
  const [teacherForm] = Form.useForm();

  function load() {
    if (flag(user, 'student')) {
      api('/student/dashboard')
        .then(setData)
        .catch((e) => setError(e.message));
      api('/gradebook/me')
        .then(setGradebook)
        .catch(() => setGradebook({ groups: [] }));
      api('/messages/teachers')
        .then((data) => setTeachers(data.teachers || []))
        .catch(() => setTeachers([]));
    }
  }

  useEffect(() => {
    load();
  }, [user?.role, user?.permissions]);

  async function submitHw(submissionId) {
    const answer = (answerDrafts[submissionId] || '').trim();
    if (!answer) return;
    try {
      await api(`/student/homework/${submissionId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answer }),
      });
      setNotice('Домашка отправлена!');
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function sendSchool(values) {
    try {
      await api('/messages/threads', {
        method: 'POST',
        body: JSON.stringify({ subject: values.subject, body: values.body }),
      });
      schoolForm.resetFields();
      message.success('Сообщение отправлено в школу');
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendTeacher(values) {
    try {
      await api('/messages/threads', {
        method: 'POST',
        body: JSON.stringify({
          subject: values.subject,
          body: values.body,
          teacherId: values.teacherId,
        }),
      });
      teacherForm.resetFields();
      message.success('Сообщение отправлено преподавателю');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!flag(user, 'student')) {
    return (
      <Card>
        <Typography.Title level={3}>Привет, {user.name}!</Typography.Title>
        <Space>
          {flag(user, 'parent') && (
            <Link to="/parent">
              <Button type="primary">Кабинет родителя</Button>
            </Link>
          )}
          {flag(user, 'office') && (
            <Link to="/office">
              <Button type="primary">Офис школы</Button>
            </Link>
          )}
          {flag(user, 'admin') && (
            <Link to="/admin/guide">
              <Button>Админ</Button>
            </Link>
          )}
          {!flag(user, 'parent') && !flag(user, 'office') && (
            <Link to={homePathFor(user)}>
              <Button type="primary">Перейти</Button>
            </Link>
          )}
        </Space>
      </Card>
    );
  }

  if (error && !data) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  const { courses, homework, upcoming, announcements, certificates, materials = [], attendance = [] } = data;

  return (
    <CabinetShell
      title={`Привет, ${user.name}!`}
      subtitle={`${user.grade ? `${user.grade} класс · ` : ''}Курсы, домашка, расписание и объявления`}
    >
      {notice && <Alert type="success" message={notice} showIcon />}
      {error && <Alert type="error" message={error} showIcon />}

      <CabinetGrid columns={2}>
        <Card className="cabinet-card" title="Написать в школу">
          <Typography.Paragraph type="secondary">
            Одно сообщение школе: его получат преподаватели и администратор.
          </Typography.Paragraph>
          <Form form={schoolForm} layout="vertical" onFinish={sendSchool}>
            <Form.Item name="subject" label="Тема" rules={[{ required: true, message: 'Введите тему' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="body" label="Текст" rules={[{ required: true, message: 'Введите текст' }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Отправить в школу
            </Button>
          </Form>
        </Card>
        <Card className="cabinet-card" title="Написать преподавателю">
          <Typography.Paragraph type="secondary">
            Отдельное сообщение одному преподавателю.
          </Typography.Paragraph>
          <Form form={teacherForm} layout="vertical" onFinish={sendTeacher}>
            <Form.Item name="teacherId" label="Преподаватель" rules={[{ required: true, message: 'Выберите преподавателя' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Кому"
                options={teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }))}
              />
            </Form.Item>
            <Form.Item name="subject" label="Тема" rules={[{ required: true, message: 'Введите тему' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="body" label="Текст" rules={[{ required: true, message: 'Введите текст' }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Отправить преподавателю
            </Button>
          </Form>
        </Card>
      </CabinetGrid>

      <CabinetGrid columns={3}>
          <Card className="cabinet-card" title="Ближайшие занятия">
            <List
              size="small"
              locale={{ emptyText: 'Пока нет' }}
              dataSource={upcoming}
              renderItem={(s) => (
                <List.Item>
                  <List.Item.Meta title={s.group_name} description={`${s.starts_at} · ${s.title || 'Занятие'}`} />
                </List.Item>
              )}
            />
          </Card>
          <Card className="cabinet-card" title="Объявления">
            <List
              size="small"
              locale={{ emptyText: 'Пока тихо' }}
              dataSource={announcements}
              renderItem={(a) => (
                <List.Item>
                  <List.Item.Meta title={a.title} description={a.body} />
                </List.Item>
              )}
            />
          </Card>
          <Card className="cabinet-card" title="Сертификаты">
            <List
              size="small"
              locale={{ emptyText: 'Пройди курс до конца' }}
              dataSource={certificates}
              renderItem={(c) => (
                <List.Item
                  actions={[
                    <Link key="open" to={`/certificates/${c.id}`}>
                      <Button size="small">Открыть</Button>
                    </Link>,
                  ]}
                >
                  <Space>
                    <span>{c.icon}</span>
                    <Typography.Text strong>{c.title}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
      </CabinetGrid>

      <Card className="cabinet-card" title="Домашние задания">
        {homework.length === 0 ? (
          <Empty description="Нет активных заданий" />
        ) : (
          <CabinetGrid columns={2}>
            {homework.map((h) => (
                <Card
                  key={h.submission_id}
                  className="cabinet-card"
                  title={h.title}
                  extra={<Tag color={h.status === 'done' ? 'success' : 'processing'}>{h.status}</Tag>}
                >
                  <Typography.Text type="secondary">
                    {h.group_name}
                    {h.due_date ? ` · до ${h.due_date}` : ''}
                  </Typography.Text>
                  <Typography.Paragraph>{h.description}</Typography.Paragraph>
                  {(h.status === 'assigned' || h.status === 'submitted') && (
                    <>
                      <Input.TextArea
                        rows={3}
                        placeholder="Твой ответ..."
                        value={answerDrafts[h.submission_id] ?? h.answer ?? ''}
                        disabled={h.status !== 'assigned'}
                        onChange={(e) =>
                          setAnswerDrafts((d) => ({ ...d, [h.submission_id]: e.target.value }))
                        }
                      />
                      {h.status === 'assigned' && (
                        <Button
                          type="primary"
                          style={{ marginTop: 8 }}
                          onClick={() => submitHw(h.submission_id)}
                        >
                          Сдать
                        </Button>
                      )}
                    </>
                  )}
                  {h.grade && <Alert type="success" message={`Оценка: ${h.grade}`} style={{ marginTop: 8 }} />}
                </Card>
            ))}
          </CabinetGrid>
        )}
      </Card>

      <Card className="cabinet-card" title="Табель">
        {(gradebook?.groups || []).length === 0 ? (
          <Empty description="Оценок пока нет" />
        ) : (
          gradebook.groups.map(({ group, student }) => (
            <div key={group?.id || student?.contact_id} style={{ marginBottom: 12 }}>
              <Typography.Text strong>
                {group?.course_title || group?.name}
                {student?.stats?.quizAvg != null ? ` · тесты ${student.stats.quizAvg}%` : ''}
              </Typography.Text>
              <List
                size="small"
                dataSource={student?.homework || []}
                locale={{ emptyText: 'Нет заданий' }}
                renderItem={(row) => (
                  <List.Item>
                    <span>{row.title}</span>
                    <Tag>{row.grade || '—'}</Tag>
                  </List.Item>
                )}
              />
            </div>
          ))
        )}
      </Card>

      <Card className="cabinet-card" title="Материалы курсов">
        {materials.length === 0 ? (
          <Empty description="Материалов пока нет" />
        ) : (
          <List
            dataSource={materials}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    item.file_id ? (
                      <Button type="link" style={{ padding: 0 }} onClick={() => setPreview(item)}>
                        {item.title}
                      </Button>
                    ) : item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    ) : (
                      item.title
                    )
                  }
                  description={`${item.icon || ''} ${item.course_title}`.trim()}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
      <MaterialPreview material={preview} open={!!preview} onClose={() => setPreview(null)} />

      {attendance.length > 0 && (
        <Card className="cabinet-card" title="Посещаемость">
          <Space wrap>
            {attendance.map((row) => (
              <Tag key={row.status}>
                {row.status}: {row.c}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      <Card className="cabinet-card" title="Мои курсы">
        {courses.length === 0 ? (
          <Empty
            description="Пока нет записанных курсов"
            children={
              <Link to="/courses">
                <Button type="primary">Выбрать курс</Button>
              </Link>
            }
          />
        ) : (
          <CabinetGrid columns={3}>
            {courses.map((course) => {
              const progress =
                course.lessonsCount > 0
                  ? Math.round((course.completedLessons / course.lessonsCount) * 100)
                  : 0;
              return (
                  <Link to={`/courses/${course.id}`} key={course.id}>
                    <Card
                      hoverable
                      className="cabinet-card course-accent"
                      style={{ '--accent': course.cover_color }}
                      title={`${course.icon} ${course.title}`}
                      extra={<Tag>{progress}%</Tag>}
                    >
                      <Typography.Paragraph type="secondary">
                        Пройдено {course.completedLessons} из {course.lessonsCount}
                      </Typography.Paragraph>
                      <Progress percent={progress} size="small" />
                    </Card>
                  </Link>
              );
            })}
          </CabinetGrid>
        )}
      </Card>
    </CabinetShell>
  );
}
