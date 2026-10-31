import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  List,
  Progress,
  Select,
  Space,
  Typography,
  Upload,
} from 'antd';
import { DeleteOutlined, InboxOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons';
import { api, downloadMaterial, uploadCourseMaterial } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';
import MaterialPreview from '../../components/MaterialPreview';

const ACCEPT =
  '.ppt,.pptx,.key,.pdf,.mp4,.webm,.mov,.doc,.docx,.odt,.txt,.rtf,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip';
const ALLOWED = new Set(ACCEPT.split(',').map((ext) => ext.slice(1)));
const MAX_BYTES = 40 * 1024 * 1024;
const TYPE_HINT =
  'Презентации (ppt, pptx, key), PDF, видео (mp4, webm, mov), документы (doc, docx, odt, txt, rtf), таблицы (xls, xlsx, csv), изображения (png, jpg, jpeg, gif, webp), архивы (zip). До 40 МБ.';
const TYPE_ERROR =
  'Этот тип файла не поддерживается. Загрузите презентацию, PDF, видео, документ, таблицу, изображение или zip.';

function fileExt(name) {
  const base = String(name || '').split(/[/\\]/).pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

export default function MaterialsPage() {
  const { user } = useAuth();
  const canUpload = can(user, 'content.teach', 'content.builder');
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(null);
  const [preview, setPreview] = useState(null);

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

  function beforeUpload(file) {
    setError('');
    setMessage('');
    const ext = fileExt(file.name);
    if (!ALLOWED.has(ext)) {
      setError(TYPE_ERROR);
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_BYTES) {
      setError('Файл больше 40 МБ. Выберите файл меньшего размера.');
      return Upload.LIST_IGNORE;
    }
    return true;
  }

  async function customRequest({ file, onSuccess, onError }) {
    setProgress(0);
    try {
      await uploadCourseMaterial(courseId, file, {
        onProgress: (pct) => setProgress(pct),
      });
      setProgress(100);
      setMessage('Файл загружен');
      onSuccess({}, file);
      await loadMaterials();
    } catch (e) {
      setProgress(null);
      setError(e.message);
      onError(e);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 4 }}>
          Материалы курсов
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Ссылки и файлы для учеников выбранного курса
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

      {canUpload && (
        <Card title="Загрузить файл" size="small">
          <Upload.Dragger
            accept={ACCEPT}
            multiple={false}
            maxCount={1}
            showUploadList={false}
            disabled={!courseId}
            beforeUpload={beforeUpload}
            customRequest={customRequest}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Перетащите файл сюда</p>
            <p className="ant-upload-hint">{TYPE_HINT}</p>
            <Button icon={<UploadOutlined />} disabled={!courseId}>
              Выбрать файл
            </Button>
          </Upload.Dragger>
          {progress != null && (
            <Progress
              percent={progress}
              status={progress >= 100 ? 'success' : 'active'}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      )}

      <Card title="Добавить ссылку" size="small">
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
                m.file_id ? (
                  <Button key="open" size="small" onClick={() => setPreview(m)}>
                    Открыть
                  </Button>
                ) : null,
                m.file_id ? (
                  <Button
                    key="download"
                    size="small"
                    onClick={() => downloadMaterial(m.id, m.original_name || m.title)}
                  >
                    Скачать
                  </Button>
                ) : null,
                <Button
                  key="del"
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => remove(m.id)}
                />,
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={
                  m.file_id ? (
                    <Button type="link" style={{ padding: 0 }} onClick={() => setPreview(m)}>
                      {m.title}
                    </Button>
                  ) : m.url ? (
                    <a href={m.url} target="_blank" rel="noreferrer">
                      <LinkOutlined /> {m.title}
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
      <MaterialPreview material={preview} open={!!preview} onClose={() => setPreview(null)} />
    </Space>
  );
}
