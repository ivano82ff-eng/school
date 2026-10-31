import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
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
  DeleteOutlined,
  FileTextOutlined,
  HolderOutlined,
  PlusOutlined,
  ReadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { api, uploadFile } from '../api';
import { useAuth } from '../auth';
import { can, homePathFor } from '../permissions';

const LABELS = {
  lesson: 'Урок',
  test: 'Проверочная',
  material: 'Материал',
};

function emptyQuestion() {
  return { question: 'Новый вопрос', options: ['Вариант 1', 'Вариант 2'], correct_index: 0 };
}

function draftsFrom(blocks) {
  const next = {};
  for (const block of blocks) {
    if (block.type === 'lesson') {
      next[block.key] = {
        title: block.title,
        content: block.content || '',
        duration_min: block.duration_min,
      };
    } else if (block.type === 'test') {
      const questions = block.questions?.length ? block.questions : [emptyQuestion()];
      next[block.key] = {
        title: block.title,
        questions: questions.map((q) => ({
          question: q.question,
          options: [...q.options],
          correct_index: q.correct_index,
        })),
      };
    } else {
      next[block.key] = {
        title: block.title,
        description: block.description || '',
        url: block.url || '',
      };
    }
  }
  return next;
}

export default function BlockBuilderPage() {
  const { user } = useAuth();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState(null);
  const [courseForm] = Form.useForm();
  const [createForm] = Form.useForm();

  const allowed = can(user, 'content.builder', 'content.teach');

  function applyBlocks(nextBlocks, resetKey) {
    setBlocks(nextBlocks);
    setDrafts((prev) => {
      const fresh = draftsFrom(nextBlocks);
      const merged = {};
      for (const key of Object.keys(fresh)) {
        merged[key] = prev[key] && key !== resetKey ? prev[key] : fresh[key];
      }
      return merged;
    });
  }

  async function loadCourses() {
    const data = await api('/outline/courses');
    setCourses(data.courses);
  }

  async function loadCourse(id) {
    const data = await api(`/outline/courses/${id}`);
    setCourse(data.course);
    applyBlocks(data.blocks);
    courseForm.setFieldsValue({
      title: data.course.title,
      description: data.course.description,
      category: data.course.category,
      grade_min: data.course.grade_min,
      grade_max: data.course.grade_max,
      icon: data.course.icon,
      cover_color: data.course.cover_color,
      published: !!data.course.published,
    });
  }

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    const job = courseId
      ? Promise.all([loadCourses(), loadCourse(courseId)])
      : loadCourses().then(() => {
          setCourse(null);
          setBlocks([]);
          setDrafts({});
        });
    job.catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [allowed, courseId]);

  if (!allowed) return <Navigate to={homePathFor(user)} replace />;

  function updateDraft(key, patch) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function createCourse(values) {
    try {
      const created = await api('/outline/courses', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('Курс создан. Добавьте блоки ниже.');
      createForm.resetFields();
      navigate(`/teacher/blocks/${created.course.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveCourse(values) {
    try {
      const saved = await api(`/outline/courses/${courseId}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      setCourse(saved.course);
      await loadCourses();
      message.success(values.published ? 'Курс виден в каталоге' : 'Курс скрыт из каталога');
    } catch (err) {
      setError(err.message);
    }
  }

  async function addBlock(type) {
    try {
      const data = await api(`/outline/courses/${courseId}/blocks`, {
        method: 'POST',
        body: JSON.stringify({ type }),
      });
      applyBlocks(data.blocks);
      message.success(`${LABELS[type]} добавлен`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBlock(block) {
    const draft = drafts[block.key];
    try {
      const data = await api(`/outline/courses/${courseId}/blocks/${block.type}/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      applyBlocks(data.blocks, block.key);
      message.success('Блок сохранён');
    } catch (err) {
      message.error(err.message);
    }
  }

  async function removeBlock(block) {
    try {
      const data = await api(`/outline/courses/${courseId}/blocks/${block.type}/${block.id}`, {
        method: 'DELETE',
      });
      applyBlocks(data.blocks, block.key);
    } catch (err) {
      message.error(err.message);
    }
  }

  async function commitOrder(next) {
    const data = await api(`/outline/courses/${courseId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({
        order: next.map((block) => ({ type: block.type, id: block.id })),
      }),
    });
    applyBlocks(data.blocks);
  }

  async function move(index, dir) {
    const swap = index + dir;
    if (swap < 0 || swap >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[swap]] = [next[swap], next[index]];
    try {
      await commitOrder(next);
    } catch (err) {
      message.error(err.message);
    }
  }

  async function dropOn(index) {
    if (dragIndex == null || dragIndex === index) return;
    const next = [...blocks];
    const [item] = next.splice(dragIndex, 1);
    next.splice(index, 0, item);
    setDragIndex(null);
    try {
      await commitOrder(next);
    } catch (err) {
      message.error(err.message);
    }
  }

  async function attachFile(block, file) {
    try {
      const uploaded = await uploadFile(file);
      const data = await api(`/outline/courses/${courseId}/blocks/material/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ file_id: uploaded.id }),
      });
      applyBlocks(data.blocks);
      message.success('Файл прикреплён');
    } catch (err) {
      message.error(err.message);
    }
  }

  function renderLesson(block) {
    const draft = drafts[block.key];
    if (!draft) return null;
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input
          value={draft.title}
          placeholder="Название урока"
          onChange={(e) => updateDraft(block.key, { title: e.target.value })}
        />
        <Input.TextArea
          rows={5}
          value={draft.content}
          placeholder="Текст урока"
          onChange={(e) => updateDraft(block.key, { content: e.target.value })}
        />
        <InputNumber
          min={5}
          value={draft.duration_min}
          addonAfter="мин"
          onChange={(value) => updateDraft(block.key, { duration_min: value || 20 })}
        />
      </Space>
    );
  }

  function renderTest(block) {
    const draft = drafts[block.key];
    if (!draft) return null;
    return (
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <Input
          value={draft.title}
          placeholder="Название проверочной"
          onChange={(e) => updateDraft(block.key, { title: e.target.value })}
        />
        {draft.questions.map((question, qIndex) => (
          <Card key={qIndex} size="small" title={`Вопрос ${qIndex + 1}`}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Input
                value={question.question}
                placeholder="Текст вопроса"
                onChange={(e) => {
                  const questions = draft.questions.map((item, i) =>
                    i === qIndex ? { ...item, question: e.target.value } : item
                  );
                  updateDraft(block.key, { questions });
                }}
              />
              <Radio.Group
                value={question.correct_index}
                onChange={(e) => {
                  const questions = draft.questions.map((item, i) =>
                    i === qIndex ? { ...item, correct_index: e.target.value } : item
                  );
                  updateDraft(block.key, { questions });
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {question.options.map((option, oIndex) => (
                    <Space key={oIndex} style={{ width: '100%' }}>
                      <Radio value={oIndex} />
                      <Input
                        style={{ width: 320 }}
                        value={option}
                        placeholder={`Вариант ${oIndex + 1}`}
                        onChange={(e) => {
                          const options = question.options.map((item, i) =>
                            i === oIndex ? e.target.value : item
                          );
                          const questions = draft.questions.map((item, i) =>
                            i === qIndex ? { ...item, options } : item
                          );
                          updateDraft(block.key, { questions });
                        }}
                      />
                      {question.options.length > 2 && (
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const options = question.options.filter((_, i) => i !== oIndex);
                            const correct =
                              question.correct_index >= options.length
                                ? 0
                                : question.correct_index > oIndex
                                  ? question.correct_index - 1
                                  : question.correct_index;
                            const questions = draft.questions.map((item, i) =>
                              i === qIndex ? { ...item, options, correct_index: correct } : item
                            );
                            updateDraft(block.key, { questions });
                          }}
                        />
                      )}
                    </Space>
                  ))}
                </Space>
              </Radio.Group>
              <Space>
                <Button
                  onClick={() => {
                    const questions = draft.questions.map((item, i) =>
                      i === qIndex
                        ? { ...item, options: [...item.options, `Вариант ${item.options.length + 1}`] }
                        : item
                    );
                    updateDraft(block.key, { questions });
                  }}
                >
                  Вариант
                </Button>
                {draft.questions.length > 1 && (
                  <Button
                    danger
                    onClick={() => {
                      updateDraft(block.key, {
                        questions: draft.questions.filter((_, i) => i !== qIndex),
                      });
                    }}
                  >
                    Удалить вопрос
                  </Button>
                )}
              </Space>
            </Space>
          </Card>
        ))}
        <Button
          icon={<PlusOutlined />}
          onClick={() =>
            updateDraft(block.key, { questions: [...draft.questions, emptyQuestion()] })
          }
        >
          Вопрос
        </Button>
        <Typography.Text type="secondary">Отметьте верный вариант.</Typography.Text>
      </Space>
    );
  }

  function renderMaterial(block) {
    const draft = drafts[block.key];
    if (!draft) return null;
    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input
          value={draft.title}
          placeholder="Название материала"
          onChange={(e) => updateDraft(block.key, { title: e.target.value })}
        />
        <Input.TextArea
          rows={2}
          value={draft.description}
          placeholder="Коротко, что внутри"
          onChange={(e) => updateDraft(block.key, { description: e.target.value })}
        />
        <Input
          value={draft.url}
          placeholder="Ссылка, если материал в интернете"
          onChange={(e) => updateDraft(block.key, { url: e.target.value })}
        />
        <Space>
          <Upload
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              attachFile(block, file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>Прикрепить файл</Button>
          </Upload>
          {block.original_name && <Typography.Text>{block.original_name}</Typography.Text>}
        </Space>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Конструктор курса
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          Один экран: курс, затем блоки «урок», «проверочная» и «материал». Порядок меняется
          стрелками или перетаскиванием. Ученики и родители видят опубликованный курс в каталоге.
        </Typography.Paragraph>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      <Card>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Открыть курс"
            style={{ minWidth: 280 }}
            value={courseId ? Number(courseId) : undefined}
            options={courses.map((item) => ({
              value: item.id,
              label: `${item.icon || ''} ${item.title}`.trim(),
            }))}
            onChange={(id) => navigate(`/teacher/blocks/${id}`)}
          />
          {courseId && (
            <Button onClick={() => navigate('/teacher/blocks')}>Новый курс</Button>
          )}
        </Space>
      </Card>

      {!courseId && (
        <Card title="Новый курс" loading={loading}>
          <Form
            form={createForm}
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
            <CourseFields />
            <Button type="primary" htmlType="submit">
              Создать и собрать блоки
            </Button>
          </Form>
        </Card>
      )}

      {courseId && course && (
        <Card title="Курс" loading={loading}>
          <Form form={courseForm} layout="vertical" onFinish={saveCourse}>
            <CourseFields />
            <Form.Item name="published" label="Показывать в каталоге" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Сохранить курс
            </Button>
          </Form>
        </Card>
      )}

      {courseId && course && (
        <Card
          title="Блоки"
          extra={
            <Space wrap>
              <Button icon={<ReadOutlined />} onClick={() => addBlock('lesson')}>
                Урок
              </Button>
              <Button icon={<FileTextOutlined />} onClick={() => addBlock('test')}>
                Проверочная
              </Button>
              <Button icon={<PlusOutlined />} onClick={() => addBlock('material')}>
                Материал
              </Button>
            </Space>
          }
        >
          {blocks.length === 0 && (
            <Typography.Paragraph type="secondary">
              Добавьте первый блок. Урок — текст, проверочная — вопросы с одним верным ответом,
              материал — ссылка или файл.
            </Typography.Paragraph>
          )}
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {blocks.map((block, index) => (
              <Card
                key={block.key}
                size="small"
                style={{ opacity: dragIndex === index ? 0.55 : 1 }}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropOn(index)}
                title={
                  <Space>
                    <HolderOutlined />
                    <Tag>{LABELS[block.type]}</Tag>
                    <span>{drafts[block.key]?.title || block.title}</span>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      aria-label="Выше"
                      icon={<ArrowUpOutlined />}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <Button
                      aria-label="Ниже"
                      icon={<ArrowDownOutlined />}
                      disabled={index === blocks.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <Popconfirm title="Удалить блок?" onConfirm={() => removeBlock(block)}>
                      <Button aria-label="Удалить" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                }
              >
                {block.type === 'lesson' && renderLesson(block)}
                {block.type === 'test' && renderTest(block)}
                {block.type === 'material' && renderMaterial(block)}
                <Button style={{ marginTop: 12 }} type="primary" onClick={() => saveBlock(block)}>
                  Сохранить блок
                </Button>
              </Card>
            ))}
          </Space>
        </Card>
      )}
    </Space>
  );
}

function CourseFields() {
  return (
    <>
      <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="Описание" rules={[{ required: true, message: 'Введите описание' }]}>
        <Input.TextArea rows={3} />
      </Form.Item>
      <Row gutter={12}>
        <Col xs={24} md={12}>
          <Form.Item name="category" label="Категория" rules={[{ required: true, message: 'Введите категорию' }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="grade_min" label="Класс от">
            <InputNumber min={1} max={11} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="grade_max" label="Класс до">
            <InputNumber min={1} max={11} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={12}>
        <Col xs={12} md={6}>
          <Form.Item name="icon" label="Значок">
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="cover_color" label="Цвет">
            <Input type="color" />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}
