import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  List,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import { api } from '../api';
import { useAuth } from '../auth';
import { can } from '../permissions';
import MaterialPreview from '../components/MaterialPreview';

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  function load() {
    api(`/courses/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function enroll() {
    if (!user) {
      navigate('/login');
      return;
    }
    setBusy(true);
    try {
      await api(`/courses/${id}/enroll`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  const { course, lessons, materials = [], program } = data;

  function programActions(item) {
    if (item.type === 'material') {
      if (item.file_id) {
        return [
          <Button key="open" size="small" onClick={() => setPreview(item)}>
            Открыть
          </Button>,
        ];
      }
      if (item.url) {
        return [
          <a key="url" href={item.url} target="_blank" rel="noreferrer">
            Открыть
          </a>,
        ];
      }
      return [];
    }
    if (!course.enrolled) {
      return [
        <Typography.Text type="secondary" key="lock">
          После записи
        </Typography.Text>,
      ];
    }
    return [
      <Link key="open" to={`/lessons/${item.id}`}>
        <Button size="small" type={item.completed ? 'default' : 'primary'}>
          {item.completed ? 'Повторить' : 'Открыть'}
        </Button>
      </Link>,
    ];
  }
  const progress =
    course.lessonsCount > 0
      ? Math.round((course.completedLessons / course.lessonsCount) * 100)
      : 0;

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Card
        style={{
          background: `linear-gradient(135deg, ${course.cover_color}22, #fff)`,
        }}
      >
        <Typography.Text type="secondary">
          {course.category} · {course.grade_min}–{course.grade_max} класс
        </Typography.Text>
        <Typography.Title level={2}>
          {course.icon} {course.title}
        </Typography.Title>
        <Typography.Paragraph>{course.description}</Typography.Paragraph>
        {course.enrolled && (
          <Progress percent={progress} status="active" style={{ maxWidth: 420 }} />
        )}
        <Space wrap style={{ marginTop: 12 }}>
          {!course.enrolled ? (
            <Button type="primary" loading={busy} onClick={enroll}>
              Записаться на курс
            </Button>
          ) : lessons[0] ? (
            <Link to={`/lessons/${lessons[0].id}`}>
              <Button type="primary">Продолжить обучение</Button>
            </Link>
          ) : null}
          <Link to="/courses">
            <Button>К каталогу</Button>
          </Link>
          {can(user, 'content.builder', 'content.teach') && (
            <Link to={`/teacher/blocks/${course.id}`}>
              <Button>Изменить курс</Button>
            </Link>
          )}
        </Space>
        {error && <Alert type="error" message={error} showIcon style={{ marginTop: 12 }} />}
      </Card>

      {Array.isArray(program) ? (
        <Card title="Программа курса">
          <List
            dataSource={program}
            locale={{ emptyText: 'В курсе пока нет блоков' }}
            renderItem={(item, idx) => (
              <List.Item actions={programActions(item)}>
                <List.Item.Meta
                  title={
                    <Space>
                      <Tag>
                        {item.type === 'test'
                          ? 'Проверочная'
                          : item.type === 'material'
                            ? 'Материал'
                            : 'Урок'}
                      </Tag>
                      {`${idx + 1}. ${item.title}`}
                    </Space>
                  }
                  description={
                    item.type === 'material'
                      ? item.original_name || item.description
                      : item.type === 'test'
                        ? 'Вопросы с одним верным ответом'
                        : `${item.duration_min} мин`
                  }
                />
                {item.completed && <Tag color="success">Пройден</Tag>}
              </List.Item>
            )}
          />
        </Card>
      ) : (
      <>
      <Card title="Уроки курса">
        <List
          dataSource={lessons}
          renderItem={(lesson, idx) => (
            <List.Item
              actions={[
                course.enrolled ? (
                  <Link key="open" to={`/lessons/${lesson.id}`}>
                    <Button size="small" type={lesson.completed ? 'default' : 'primary'}>
                      {lesson.completed ? 'Повторить' : 'Открыть'}
                    </Button>
                  </Link>
                ) : (
                  <Typography.Text type="secondary" key="lock">
                    После записи
                  </Typography.Text>
                ),
              ]}
            >
              <List.Item.Meta
                title={`${idx + 1}. ${lesson.title}`}
                description={`${lesson.duration_min} мин`}
              />
              {lesson.completed && <Tag color="success">Пройден</Tag>}
            </List.Item>
          )}
        />
      </Card>

      {materials.length > 0 && (
        <Card title="Материалы">
          <List
            dataSource={materials}
            renderItem={(m) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    m.file_id ? (
                      <Button type="link" style={{ padding: 0 }} onClick={() => setPreview(m)}>
                        {m.title}
                      </Button>
                    ) : m.url ? (
                      <a href={m.url} target="_blank" rel="noreferrer">
                        {m.title}
                      </a>
                    ) : (
                      m.title
                    )
                  }
                  description={m.file_id ? m.original_name || m.description : m.description}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
      </>
      )}
      <MaterialPreview material={preview} open={!!preview} onClose={() => setPreview(null)} />
    </Space>
  );
}
