import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';

export default function LandingsPage() {
  const { user } = useAuth();
  const allowed = can(user, 'marketing.landings');
  const [pages, setPages] = useState([]);
  const [themes, setThemes] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  function load() {
    return Promise.all([api('/landings'), api('/landings/meta')]).then(([p, m]) => {
      setPages(p.pages || []);
      setThemes(m.themes || []);
    });
  }

  useEffect(() => {
    if (!allowed) return;
    load().catch((e) => setError(e.message));
  }, [allowed]);

  if (!allowed) return <Navigate to="/office" replace />;

  async function create(values) {
    try {
      const data = await api('/landings', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      message.success('Лендинг создан');
      setOpen(false);
      form.resetFields();
      window.location.href = `/office/landings/${data.page.id}/edit`;
    } catch (e) {
      message.error(e.message);
    }
  }

  async function publish(id, status) {
    try {
      await api(`/landings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      message.success(status === 'published' ? 'Опубликовано' : 'Снято с публикации');
      await load();
    } catch (e) {
      message.error(e.message);
    }
  }

  async function duplicate(id) {
    try {
      const data = await api(`/landings/${id}/duplicate`, { method: 'POST' });
      message.success('Копия создана');
      window.location.href = `/office/landings/${data.page.id}/edit`;
    } catch (e) {
      message.error(e.message);
    }
  }

  async function remove(id) {
    try {
      await api(`/landings/${id}`, { method: 'DELETE' });
      message.success('Удалено');
      await load();
    } catch (e) {
      message.error(e.message);
    }
  }

  const columns = [
    {
      title: 'Название',
      dataIndex: 'title',
      render: (t, row) => (
        <Space direction="vertical" size={0}>
          <Link to={`/office/landings/${row.id}/edit`}>{t}</Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            /l/{row.slug}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      render: (s) => (
        <Tag color={s === 'published' ? 'green' : s === 'archived' ? 'default' : 'orange'}>
          {s}
        </Tag>
      ),
    },
    { title: 'Тема', dataIndex: 'theme_name', render: (v) => v || '—' },
    { title: 'Блоки', dataIndex: 'blocks_count' },
    { title: 'Просмотры', dataIndex: 'views' },
    { title: 'Лиды', dataIndex: 'leads_count' },
    {
      title: '',
      key: 'a',
      render: (_, row) => (
        <Space wrap>
          <Link to={`/office/landings/${row.id}/edit`}>
            <Button size="small">Редактор</Button>
          </Link>
          <Link to={`/office/landings/${row.id}/analytics`}>
            <Button size="small">Аналитика</Button>
          </Link>
          {row.status === 'published' ? (
            <>
              <a href={`/l/${row.slug}`} target="_blank" rel="noreferrer">
                <Button size="small">Открыть</Button>
              </a>
              <Button size="small" onClick={() => publish(row.id, 'draft')}>
                Снять
              </Button>
            </>
          ) : (
            <Button size="small" type="primary" onClick={() => publish(row.id, 'published')}>
              Опубликовать
            </Button>
          )}
          <Button size="small" onClick={() => duplicate(row.id)}>
            Копия
          </Button>
          <Button size="small" danger onClick={() => remove(row.id)}>
            Удалить
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Лендинги и акции
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Конструктор промо-страниц: темы, блоки, опросы, геймификация, лиды в CRM
          </Typography.Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Новый лендинг
        </Button>
      </Space>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      <Card>
        <Table rowKey="id" columns={columns} dataSource={pages} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="Новый лендинг"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Создать"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={create}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input placeholder="Летняя акция Python" />
          </Form.Item>
          <Form.Item name="slug" label="URL-slug (необязательно)">
            <Input placeholder="python-leto" addonBefore="/l/" />
          </Form.Item>
          <Form.Item name="theme_id" label="Тема оформления">
            <Select
              allowClear
              options={themes.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Выберите тему"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
