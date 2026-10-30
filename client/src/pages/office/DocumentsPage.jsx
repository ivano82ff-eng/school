import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { api, downloadFile, uploadFile } from '../../api';
import { useAuth } from '../../auth';
import { can } from '../../permissions';

const DOC_TYPES = [
  { value: 'contract', label: 'Договор' },
  { value: 'homework', label: 'ДЗ / работа' },
  { value: 'material', label: 'Материал' },
  { value: 'lesson_asset', label: 'Ассет урока' },
  { value: 'other', label: 'Прочее' },
];

export default function DocumentsPage() {
  const { user } = useAuth();
  const isStaff = can(user, 'office.documents', 'content.teach');
  const [docs, setDocs] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [filter, setFilter] = useState();
  const [error, setError] = useState('');

  function load() {
    const q = new URLSearchParams();
    if (filter) q.set('doc_type', filter);
    api(`/documents?${q}`)
      .then((d) => setDocs(d.documents || []))
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    if (isStaff) {
      api('/contacts')
        .then((d) => setContacts(d.contacts || []))
        .catch(() => {});
    }
  }, [filter, isStaff]);

  async function onCreate(values) {
    try {
      const file = await uploadFile(values.upload[0].originFileObj);
      await api('/documents', {
        method: 'POST',
        body: JSON.stringify({
          file_id: file.id,
          title: values.title,
          doc_type: values.doc_type,
          contact_id: values.contact_id,
          notes: values.notes,
          entity_type: values.entity_type || null,
          entity_id: values.entity_id || null,
        }),
      });
      message.success('Документ сохранён');
      load();
    } catch (e) {
      message.error(e.message);
    }
  }

  const columns = [
    {
      title: 'Документ',
      render: (_, d) => (
        <div>
          <strong>{d.title}</strong>
          <div>
            <Typography.Text type="secondary">{d.file?.original_name}</Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'doc_type',
      render: (t) => <Tag>{t}</Tag>,
    },
    {
      title: 'Связь',
      render: (_, d) =>
        d.contact_id
          ? `contact #${d.contact_id}`
          : d.entity_type
            ? `${d.entity_type}:${d.entity_id}`
            : '—',
    },
    { title: 'Когда', dataIndex: 'created_at', width: 160 },
    {
      title: '',
      width: 100,
      render: (_, d) => (
        <Button
          icon={<DownloadOutlined />}
          onClick={() => downloadFile(d.file_id, d.file?.original_name)}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 4 }}>
          Документы
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Договоры, файлы к ДЗ и материалы — Documents lite
        </Typography.Paragraph>
      </div>

      {error && <Alert type="error" message={error} showIcon />}

      <Select
        allowClear
        placeholder="Тип"
        style={{ width: 200 }}
        value={filter}
        onChange={setFilter}
        options={DOC_TYPES}
      />

      <Card title="Загрузить" size="small">
        <Form layout="vertical" onFinish={onCreate} style={{ maxWidth: 560 }} initialValues={{ doc_type: isStaff ? 'contract' : 'homework' }}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="doc_type" label="Тип" rules={[{ required: true }]}>
            <Select options={DOC_TYPES} />
          </Form.Item>
          {isStaff && (
            <Form.Item name="contact_id" label="Контакт (ученик/родитель)">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={contacts.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.type})`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="notes" label="Заметка">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="upload"
            label="Файл"
            valuePropName="fileList"
            getValueFromEvent={(e) => e?.fileList}
            rules={[{ required: true, message: 'Выберите файл' }]}
          >
            <Upload beforeUpload={() => false} maxCount={1}>
              <Button icon={<UploadOutlined />}>Выбрать</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Сохранить
          </Button>
        </Form>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table rowKey="id" columns={columns} dataSource={docs} pagination={{ pageSize: 10 }} />
      </Card>
    </Space>
  );
}
