import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { api, uploadFile } from '../api';

const TYPE_LABELS = {
  section: 'Раздел',
  heading: 'Заголовок',
  markdown: 'Markdown',
  html: 'HTML',
  video: 'Видео',
  file: 'Файл',
  presentation: 'Презентация',
  image: 'Изображение',
  code: 'Код',
  callout: 'Callout',
  embed: 'Embed/iframe',
  divider: 'Разделитель',
  quiz: 'Тест',
  checklist: 'Чеклист',
  grade_info: 'Связь с оценкой',
  download: 'Скачивание',
};

export default function CourseBuilderPage() {
  const { courseId } = useParams();
  const [data, setData] = useState(null);
  const [lessonId, setLessonId] = useState(null);
  const [error, setError] = useState('');
  const [blockModal, setBlockModal] = useState(false);
  const [editBlock, setEditBlock] = useState(null);

  async function load() {
    const d = await api(`/builder/courses/${courseId}`);
    setData(d);
    if (!lessonId && d.lessons?.[0]) setLessonId(d.lessons[0].id);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [courseId]);

  const lesson = data?.lessons?.find((l) => l.id === lessonId);

  async function addSection(values) {
    await api(`/builder/courses/${courseId}/sections`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    message.success('Раздел создан');
    await load();
  }

  async function addLesson(values) {
    const created = await api(`/builder/courses/${courseId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
    message.success('Урок создан');
    await load();
    setLessonId(created.lesson.id);
  }

  async function saveLessonMeta(values) {
    await api(`/builder/lessons/${lessonId}`, {
      method: 'PATCH',
      body: JSON.stringify(values),
    });
    message.success('Урок обновлён');
    await load();
  }

  async function createBlock(values) {
    let file_id = values.file_id || null;
    if (values.uploadFile?.[0]?.originFileObj) {
      const f = await uploadFile(values.uploadFile[0].originFileObj);
      file_id = f.id;
    }

    let config = values.config || {};
    if (values.type === 'quiz' && values.quiz_json) {
      try {
        config = { ...config, questions: JSON.parse(values.quiz_json) };
      } catch {
        message.error('quiz_json должен быть валидным JSON');
        return;
      }
    }
    if (values.type === 'checklist' && values.checklist_text) {
      config = {
        ...config,
        items: values.checklist_text.split('\n').map((s) => s.trim()).filter(Boolean),
      };
    }
    if (values.type === 'video' || values.type === 'embed') {
      config = { ...config, url: values.media_url || values.content };
    }
    if (values.type === 'callout') {
      config = { ...config, tone: values.tone || 'info' };
    }
    if (values.auto_grade != null) config.auto_grade = values.auto_grade;
    if (values.max_score != null) config.max_score = values.max_score;
    if (values.complete_lesson != null) config.complete_lesson = values.complete_lesson;

    const payload = {
      type: values.type,
      title: values.title,
      content: values.content || '',
      slug: values.slug,
      file_id,
      criteria_id: values.criteria_id,
      config,
    };

    if (editBlock) {
      await api(`/builder/blocks/${editBlock.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      message.success('Блок обновлён');
    } else {
      await api(`/builder/lessons/${lessonId}/blocks`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      message.success('Блок добавлен');
    }
    setBlockModal(false);
    setEditBlock(null);
    await load();
  }

  async function moveBlock(block, dir) {
    if (!lesson) return;
    const ids = lesson.blocks.map((b) => b.id);
    const idx = ids.indexOf(block.id);
    const swap = idx + dir;
    if (swap < 0 || swap >= ids.length) return;
    [ids[idx], ids[swap]] = [ids[swap], ids[idx]];
    await api(`/builder/lessons/${lessonId}/blocks/reorder`, {
      method: 'POST',
      body: JSON.stringify({ order: ids }),
    });
    await load();
  }

  async function removeBlock(id) {
    await api(`/builder/blocks/${id}`, { method: 'DELETE' });
    await load();
  }

  async function share(target_type, target_id, label) {
    const res = await api('/shares', {
      method: 'POST',
      body: JSON.stringify({ target_type, target_id, label }),
    });
    const url = `${window.location.origin}${res.url_path}`;
    await navigator.clipboard.writeText(url);
    message.success(`Ссылка скопирована: ${url}`);
  }

  if (error && !data) return <Alert type="error" message={error} showIcon />;
  if (!data) return <Card loading />;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Typography.Title level={2} style={{ marginBottom: 4 }}>
            Конструктор: {data.course.icon} {data.course.title}
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Разделы → уроки → виджеты/файлы/тесты/привязка к дневнику · slug:{' '}
            <Tag>{data.course.slug || '—'}</Tag>
          </Typography.Paragraph>
        </div>
        <Space>
          <Link to="/teacher">
            <Button>Назад</Button>
          </Link>
          <Button
            icon={<LinkOutlined />}
            onClick={() => share('course', data.course.id, data.course.title)}
          >
            Ссылка на курс
          </Button>
        </Space>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Разделы курса" size="small">
            {(data.sections || []).map((s) => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <Space>
                  <strong>{s.title}</strong>
                  <Tag>{s.slug}</Tag>
                  <Button
                    size="small"
                    type="text"
                    icon={<CopyOutlined />}
                    onClick={() => share('section', s.id, s.title)}
                  />
                </Space>
              </div>
            ))}
            <Divider />
            <Form layout="vertical" onFinish={addSection}>
              <Form.Item name="title" rules={[{ required: true }]} label="Новый раздел">
                <Input placeholder="Модуль 1" />
              </Form.Item>
              <Button htmlType="submit" block icon={<PlusOutlined />}>
                Добавить раздел
              </Button>
            </Form>
          </Card>

          <Card title="Уроки" size="small" style={{ marginTop: 16 }}>
            <Select
              style={{ width: '100%', marginBottom: 12 }}
              value={lessonId}
              onChange={setLessonId}
              options={(data.lessons || []).map((l) => ({
                value: l.id,
                label: `${l.title} (${(l.blocks || []).length} блоков)`,
              }))}
            />
            <Form layout="vertical" onFinish={addLesson}>
              <Form.Item name="title" rules={[{ required: true }]} label="Новый урок">
                <Input />
              </Form.Item>
              <Form.Item name="section_id" label="Раздел">
                <Select
                  allowClear
                  options={(data.sections || []).map((s) => ({ value: s.id, label: s.title }))}
                />
              </Form.Item>
              <Form.Item name="content" label="Стартовый markdown">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>
                Создать урок
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {!lesson ? (
            <Card>Выберите или создайте урок</Card>
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Card
                title={`Урок: ${lesson.title}`}
                extra={
                  <Space>
                    <Button
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => share('lesson', lesson.id, lesson.title)}
                    >
                      Share
                    </Button>
                    <Tag>{lesson.slug}</Tag>
                  </Space>
                }
              >
                <Form
                  layout="vertical"
                  key={lesson.id}
                  initialValues={{
                    title: lesson.title,
                    summary: lesson.summary,
                    duration_min: lesson.duration_min,
                    section_id: lesson.section_id,
                    slug: lesson.slug,
                  }}
                  onFinish={saveLessonMeta}
                >
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="title" label="Название" rules={[{ required: true }]}>
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="slug" label="Slug (для ссылок)">
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="summary" label="Краткое описание">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Space>
                    <Form.Item name="duration_min" label="Минут">
                      <InputNumber min={5} />
                    </Form.Item>
                    <Form.Item name="section_id" label="Раздел">
                      <Select
                        allowClear
                        style={{ minWidth: 180 }}
                        options={(data.sections || []).map((s) => ({ value: s.id, label: s.title }))}
                      />
                    </Form.Item>
                    <Button htmlType="submit">Сохранить мета</Button>
                  </Space>
                </Form>
              </Card>

              <Card
                title="Блоки / виджеты"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      setEditBlock(null);
                      setBlockModal(true);
                    }}
                  >
                    Добавить блок
                  </Button>
                }
              >
                {(lesson.blocks || []).map((b) => (
                  <Card
                    key={b.id}
                    size="small"
                    style={{ marginBottom: 8 }}
                    title={
                      <Space wrap>
                        <Tag>{TYPE_LABELS[b.type] || b.type}</Tag>
                        <span>{b.title}</span>
                        <Typography.Text type="secondary">#{b.slug}</Typography.Text>
                        {b.criteria && <Tag color="processing">{b.criteria.name}</Tag>}
                        {b.file && <Tag>{b.file.original_name}</Tag>}
                      </Space>
                    }
                    extra={
                      <Space>
                        <Button size="small" icon={<ArrowUpOutlined />} onClick={() => moveBlock(b, -1)} />
                        <Button size="small" icon={<ArrowDownOutlined />} onClick={() => moveBlock(b, 1)} />
                        <Button
                          size="small"
                          icon={<LinkOutlined />}
                          onClick={() => share('block', b.id, b.title)}
                        />
                        <Button
                          size="small"
                          onClick={() => {
                            setEditBlock(b);
                            setBlockModal(true);
                          }}
                        >
                          Изменить
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeBlock(b.id)}
                        />
                      </Space>
                    }
                  >
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                      {b.content || JSON.stringify(b.config || {})}
                    </Typography.Paragraph>
                  </Card>
                ))}
              </Card>
            </Space>
          )}
        </Col>
      </Row>

      <Modal
        title={editBlock ? 'Редактировать блок' : 'Новый блок'}
        open={blockModal}
        onCancel={() => {
          setBlockModal(false);
          setEditBlock(null);
        }}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Form
          layout="vertical"
          onFinish={createBlock}
          initialValues={{
            type: editBlock?.type || 'markdown',
            title: editBlock?.title || '',
            content: editBlock?.content || '',
            slug: editBlock?.slug,
            criteria_id: editBlock?.criteria_id,
            media_url: editBlock?.config?.url,
            tone: editBlock?.config?.tone || 'info',
            auto_grade: editBlock?.config?.auto_grade !== false,
            max_score: editBlock?.config?.max_score || 5,
            complete_lesson: !!editBlock?.config?.complete_lesson,
            quiz_json: editBlock?.type === 'quiz'
              ? JSON.stringify(editBlock.config?.questions || [], null, 2)
              : JSON.stringify(
                  [
                    {
                      id: 1,
                      question: 'Вопрос?',
                      options: ['A', 'B', 'C'],
                      correct_index: 0,
                    },
                  ],
                  null,
                  2
                ),
            checklist_text: (editBlock?.config?.items || []).join('\n'),
          }}
        >
          <Form.Item name="type" label="Тип виджета" rules={[{ required: true }]}>
            <Select
              options={(data.block_types || Object.keys(TYPE_LABELS)).map((t) => ({
                value: t,
                label: TYPE_LABELS[t] || t,
              }))}
            />
          </Form.Item>
          <Form.Item name="title" label="Заголовок" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug блока (якорь ссылки)">
            <Input placeholder="auto" />
          </Form.Item>
          <Form.Item name="content" label="Контент / подпись">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="media_url" label="URL (video/embed)">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="tone" label="Callout tone">
            <Select
              options={[
                { value: 'info', label: 'info' },
                { value: 'success', label: 'success' },
                { value: 'warning', label: 'warning' },
                { value: 'error', label: 'error' },
              ]}
            />
          </Form.Item>
          <Form.Item name="quiz_json" label="Вопросы теста (JSON)">
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="checklist_text" label="Чеклист (по строке)">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="criteria_id" label="Привязка к критерию дневника">
            <Select
              allowClear
              options={(data.criteria || []).map((c) => ({
                value: c.id,
                label: `${c.name} (${c.code})`,
              }))}
            />
          </Form.Item>
          <Space wrap>
            <Form.Item name="auto_grade" label="Автооценка в дневник" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="max_score" label="Макс балл">
              <InputNumber min={1} max={100} />
            </Form.Item>
            <Form.Item name="complete_lesson" label="Зачёт урока при 100%" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item
            name="uploadFile"
            label="Файл / презентация / изображение"
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
          >
            <Upload beforeUpload={() => false} maxCount={1}>
              <Button>Выбрать файл</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Сохранить блок
          </Button>
        </Form>
      </Modal>
    </Space>
  );
}
